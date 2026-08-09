import { Browser } from '@playwright/test';
import { HeaderBar } from '../../pages/HeaderBar';

const STORAGE_STATE_PATH = 'playwright/.auth/user.json';
const BASE_URL = 'https://sauce-demo.myshopify.com';

/**
 * Starts a browser context already signed in, standing in for a "sign in"
 * PRECONDITION — never for a sign-in that a test case carries as a step.
 *
 * The login form is hCaptcha-protected and rejects any browser Playwright
 * drives, confirmed against bundled Chromium and against real Chrome with a
 * human solving the puzzle correctly in each case (see auth-setup-guide.md
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
 * auth-setup-guide.md for the capture steps.
 */
export async function startSignedInContext(browser: Browser) {
  const context = await browser.newContext({ baseURL: BASE_URL, storageState: STORAGE_STATE_PATH });
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
  const context = await browser.newContext({ baseURL: BASE_URL });
  const page = await context.newPage();
  const header = new HeaderBar(page);
  return { context, page, header };
}
