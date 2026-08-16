import { Browser, chromium, devices, Page, TestInfo } from '@playwright/test';
import { HeaderBar } from '../../pages/HeaderBar';
import { RegisterPage } from '../../pages/RegisterPage';

const STORAGE_STATE_PATH = 'playwright/.auth/user.json';
const BASE_URL = 'https://sauce-demo.myshopify.com';

/**
 * Video for contexts this file creates by hand.
 *
 * playwright.config.ts's `video` setting only reaches contexts made by the
 * built-in page/context fixtures. Tracing can be switched on for a context
 * after it exists, which is why trace.zip appears for these tests, but video
 * recording has to be requested AT CREATION — so a context from
 * browser.newContext() records nothing unless recordVideo is passed here.
 * Confirmed by a failed run whose artefacts folder held test-failed-1.png and
 * trace.zip but no .webm at all.
 *
 * Same reason baseURL is passed explicitly below: a manually created context
 * inherits neither.
 *
 * Gated on EVIDENCE so ordinary compliance runs stay lean, matching the config.
 * The spec attaches the files to the report once the contexts are closed —
 * the .webm is only finalised on close.
 */
const recordVideo = process.env.EVIDENCE ? { dir: 'test-results/videos' } : undefined;

/**
 * A Chromium profile directory that survives between runs, unlike the
 * throwaway profile Playwright creates for every ordinary context.
 *
 * Retained for TC-07-013 #4 ("close the browser entirely, reopen it, do not
 * clear cookies"), which asks whether the BROWSER persisted the session
 * cookie. Loading a storageState JSON file cannot answer that — it only
 * proves a cookie can be injected. Relaunching the same profile directory
 * answers it honestly: the cookie survives the restart or it does not.
 *
 * Gitignored via playwright/.auth/* — once signed in, the profile holds live
 * session cookies and must never be committed (SPR-24).
 */
export const PERSISTENT_PROFILE_DIR = 'playwright/.auth/chromium-profile';

/**
 * Starts a browser context already signed in, standing in for a "sign in"
 * PRECONDITION — never for a sign-in that a test case carries as a step.
 *
 * The login form is hCaptcha-protected and rejects any browser Playwright
 * drives, confirmed against bundled Chromium and against real Chrome with a
 * human solving the puzzle correctly in each case (see docs/auth-setup-guide.md
 * and tests/_infra/auth-session.spec.ts). TP-07-004 is the one FN-07
 * procedure where that constraint does not bite: TC-07-015 tests whether a
 * session is confined to the browser it was established in, so signing in is
 * only how Browser A arrives at its starting state, not the behaviour under
 * test.
 *
 * baseURL is passed explicitly — a manually created context does not inherit
 * it from playwright.config.ts the way the default page fixture does.
 *
 * Requires a freshly captured playwright/.auth/user.json; see
 * docs/auth-setup-guide.md for the capture steps.
 */
export async function startSignedInContext(browser: Browser) {
  const context = await browser.newContext({
    baseURL: BASE_URL,
    storageState: STORAGE_STATE_PATH,
    recordVideo,
  });
  const page = await context.newPage();
  const header = new HeaderBar(page);
  return { context, page, header };
}

/**
 * A second browser whose storage and cookies are independent of the first,
 * as ENV-18 requires. Playwright contexts are isolated by construction — no
 * shared cookie jar, no shared storage — so this is a genuine guest browser
 * rather than the first one with its state cleared, which SPR-25 forbids
 * mid-procedure anyway.
 */
export async function startGuestContext(browser: Browser) {
  const context = await browser.newContext({ baseURL: BASE_URL, recordVideo });
  const page = await context.newPage();
  const header = new HeaderBar(page);
  return { context, page, header };
}

/**
 * Launches bundled Chromium against PERSISTENT_PROFILE_DIR.
 *
 * Deliberately matched to the `chromium` project in playwright.config.ts —
 * same devices['Desktop Chrome'] descriptor, same slowMo — so FN-07's
 * evidence stays comparable to FN-01 through FN-06's. NOTE that descriptor
 * makes the browser announce a Chrome User-Agent while the binary is
 * bundled Chromium, so traces and reports will show a UA claiming Chrome.
 * The browser actually under test is Chromium and must be documented as such.
 *
 * Headed by default so a run can be watched; override with HEADLESS=1.
 *
 * baseURL is passed explicitly — a manually launched context does not
 * inherit it from playwright.config.ts the way the default page fixture
 * does. launchPersistentContext returns the context itself; there is no
 * separate browser object, so closing the context closes the browser.
 */
export async function startPersistentContext(profileDir: string = PERSISTENT_PROFILE_DIR) {
  const context = await chromium.launchPersistentContext(profileDir, {
    ...devices['Desktop Chrome'],
    baseURL: BASE_URL,
    headless: !!process.env.HEADLESS,
    slowMo: Number(process.env.SLOWMO ?? 600),
  });
  const page = context.pages()[0] ?? (await context.newPage());
  const header = new HeaderBar(page);
  return { context, page, header };
}

const STORE_HOST = 'sauce-demo.myshopify.com';

/**
 * A form submission that actually reached the store: a POST to one of the
 * customer-account endpoints. Shopify's classic forms post to /account/login
 * (sign in) and /account (create customer).
 *
 * Scoped to those paths deliberately. Matching any POST to the store host
 * gives false positives â€” the storefront fires an analytics beacon to
 * /api/collect on its own schedule, and on 12 August that beacon ended an
 * assisted wait after ~30s and was misread as the login having gone through.
 */
function isAccountPost(url: string, method: string) {
  try {
    const parsed = new URL(url);
    return parsed.hostname === STORE_HOST && method === 'POST' && parsed.pathname.startsWith('/account');
  } catch {
    return false;
  }
}

/**
 * Waits out a form submission: long enough for the store to respond, or for
 * the captcha to inject itself so its presence can be recorded, and no
 * longer.
 */
export async function settleAfterSubmit(page: Page) {
  await page.waitForLoadState('domcontentloaded').catch(() => {});
  // The captcha injects itself asynchronously after the submit attempt, so
  // a short settle is needed before asking whether it appeared.
  await page.waitForTimeout(4_000);
}

/**
 * Records every request that actually reaches the store, matching on
 * hostname rather than substring — third-party trackers on this storefront
 * carry the store's own URL inside their query strings, so a substring
 * match reports requests that never went near it.
 *
 * This exists because of what the FN-07 form probe found on 12 August: a
 * submission the captcha intercepts produces NO request to the store at
 * all. Without this, a blocked attempt and a correctly-refused one are
 * indistinguishable in the evidence — both leave the shopper on the form
 * with no session. SPR-23 requires recording which messages were shown and
 * which were not, and that record is only meaningful alongside whether the
 * store was ever asked.
 */
type StoreRequest = { status: number; method: string; url: string };

export function watchStoreRequests(page: Page) {
  const entries: StoreRequest[] = [];
  page.on('response', (response) => {
    try {
      if (new URL(response.url()).hostname === STORE_HOST) {
        entries.push({
          status: response.status(),
          method: response.request().method(),
          url: response.url(),
        });
      }
    } catch {
      /* malformed URL — not a store request */
    }
  });
  return {
    entries,
    reset: () => (entries.length = 0),
    /**
     * A form submission that reached the store shows up as a POST to it.
     * Checked on the method, NOT on "did anything at all arrive": the page
     * keeps pulling its own stylesheets, scripts and Shopify widgets from
     * the same host long after load, so any-request-at-all is always true
     * and says nothing about whether the form was submitted.
     */
    sawPost: () => entries.some((e) => isAccountPost(e.url, e.method)),
    format: () => entries.map((e) => `${e.status} ${e.method} ${e.url}`),
  };
}

export type SubmissionOutcome = {
  destinationUrl: string;
  reachedStore: boolean;
  captchaPresented: boolean;
  messages: string[];
  signedIn: boolean;
  storeRequests: string[];
};

/** Whatever the page displays as an error or status, however this theme marks it. */
async function displayedMessages(page: Page): Promise<string[]> {
  return (
    await page.locator('.errors, .error, .form-message, [role="alert"], [aria-live]').allInnerTexts()
  )
    .map((t) => t.trim())
    .filter(Boolean);
}

/**
 * Fills the registration form and submits it, then classifies what came
 * back. Omitted fields are left exactly as the form renders them, which is
 * what TC-07-003 and TC-07-008 need — they test one empty field at a time
 * with the rest populated.
 *
 * `fill('')` is used rather than skipping a field, so a value left over
 * from a previous attempt on the same page cannot leak into this one.
 */
export async function attemptRegistration(
  page: Page,
  watcher: ReturnType<typeof watchStoreRequests>,
  values: { firstName?: string; lastName?: string; email?: string; password?: string },
): Promise<SubmissionOutcome> {
  const register = new RegisterPage(page);
  await register.goto();
  watcher.reset();

  await register.firstNameField.fill(values.firstName ?? '');
  await register.lastNameField.fill(values.lastName ?? '');
  await register.emailField.fill(values.email ?? '');
  await register.passwordField.fill(values.password ?? '');

  await register.createButton.click();
  await settleAfterSubmit(page);

  const captchaPresented =
    (await page.locator('iframe[src*="hcaptcha"], iframe[src*="recaptcha"]').count()) > 0 ||
    (await page.locator('[data-cptcha]').count()) > 0;

  return {
    destinationUrl: page.url(),
    reachedStore: watcher.sawPost(),
    captchaPresented,
    messages: await displayedMessages(page),
    signedIn: (await page.locator('#customer_logout_link').count()) > 0,
    storeRequests: watcher.format(),
  };
}

/**
 * SPR-23 / SPR-26 evidence for one registration attempt, including the
 * store-reached flag that separates the rule under test from a bot block.
 */
export async function recordAttempt(
  testInfo: TestInfo,
  label: string,
  entered: Record<string, string>,
  outcome: SubmissionOutcome,
) {
  await testInfo.attach(`Attempt — ${label}`, {
    body:
      `VALUES ENTERED\n` +
      Object.entries(entered).map(([k, v]) => `  ${k}: ${JSON.stringify(v)}`).join('\n') +
      `\n\nOUTCOME\n` +
      `  destination:        ${outcome.destinationUrl}\n` +
      `  reached the store:  ${outcome.reachedStore}\n` +
      `  captcha presented:  ${outcome.captchaPresented}\n` +
      `  signed in:          ${outcome.signedIn}\n` +
      `\nMESSAGES SHOWN (SPR-23)\n` +
      (outcome.messages.length
        ? outcome.messages.map((m) => `  - ${m}`).join('\n')
        : '  (none displayed)') +
      `\n\nSTORE REQUESTS DURING THIS ATTEMPT\n` +
      (outcome.storeRequests.length
        ? outcome.storeRequests.map((r) => `  ${r}`).join('\n')
        : '  (none)') +
      `\n\nHOW TO READ "reached the store": it is true only when a POST to the store\n` +
      `was observed. GET traffic listed above is the page loading its own assets\n` +
      `and Shopify widgets, and does not indicate a submission.\n\n` +
      `"reached the store: false" together with "captcha presented: true" means\n` +
      `this attempt was intercepted client-side and the store never evaluated it.\n` +
      `The rule this step exercises was therefore NOT reached, no account was\n` +
      `created, and the absence of any message above is a property of the block\n` +
      `rather than of the store's validation.`,
    contentType: 'text/plain',
  });
}
