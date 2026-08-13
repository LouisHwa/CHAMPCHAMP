import { Browser, BrowserContext, Page, TestInfo, test } from '@playwright/test';
import { HeaderBar } from '../../pages/HeaderBar';
import { SidebarNav } from '../../pages/SidebarNav';
import { AddressBookPage } from '../../pages/AddressBookPage';
import { MyAccountPage } from '../../pages/MyAccountPage';

const STORAGE_STATE_PATH = 'playwright/.auth/user.json';
const BASE_URL = 'https://sauce-demo.myshopify.com';

/**
 * Video-recording options for a manually created context.
 *
 * A context made with browser.newContext() does NOT inherit `video` from
 * playwright.config.ts's `use` block — only the built-in page/context
 * fixture does, which is the same reason baseURL has to be passed
 * explicitly below. Trace and screenshots still arrive, because the runner
 * instruments contexts AFTER creation, but recordVideo has to be set AT
 * creation. Confirmed 13 Aug: TP-06-001's output folder held trace.zip and
 * test-failed-1.png but no video.webm at all.
 *
 * Videos are written into testInfo.outputDir so they land beside the trace
 * for that test, and are attached to the report by closeContextWithVideo.
 */
export function videoOptions(testInfo?: TestInfo) {
  return testInfo ? { recordVideo: { dir: testInfo.outputDir } } : {};
}

/**
 * Closes a manually created context and attaches its video to the report.
 *
 * Playwright only finalises a recording when its context closes, and the
 * file path is only resolvable afterwards — so the Video handle is taken
 * before the close and awaited after it. Everything is best-effort: this
 * runs from a `finally`, where a throw would replace the error being
 * handled (see runWrapUp), and a missing video must never be the reason a
 * procedure reports failure.
 */
export async function closeContextWithVideo(
  context: BrowserContext,
  page: Page,
  testInfo: TestInfo,
  label: string,
) {
  const video = page.video();
  await context.close().catch(() => {});
  if (!video) return;
  try {
    await testInfo.attach(`Video — ${label}`, { path: await video.path(), contentType: 'video/webm' });
  } catch {
    // Recording may not exist if the context died before any frame was
    // captured — not worth failing a procedure over.
  }
}

/**
 * Starts a browser context already signed in, standing in for a live
 * "sign in" step wherever a TC calls for one — the login form is
 * hCaptcha-protected and rejects any Playwright-driven browser
 * regardless of pacing (confirmed all session). Needs a real, freshly
 * captured storageState file — see running-tests-guide.md. Defaults to
 * TEST_ACCOUNT's session; TP-06-006 passes FRESH_ACCOUNT_STATE_PATH
 * instead, for ENV-14's freshly registered account. baseURL is passed
 * explicitly since manually created contexts don't inherit it from
 * playwright.config.ts the way the default page/context fixture does.
 */
export async function startSignedInContext(
  browser: Browser,
  storageStatePath: string = STORAGE_STATE_PATH,
  testInfo?: TestInfo,
) {
  const context = await browser.newContext({
    baseURL: BASE_URL,
    storageState: storageStatePath,
    ...videoOptions(testInfo),
  });
  const page = await context.newPage();
  const header = new HeaderBar(page);
  const sidebar = new SidebarNav(page);
  const addressBook = new AddressBookPage(page);
  const myAccount = new MyAccountPage(page);
  return { context, page, header, sidebar, addressBook, myAccount };
}

/**
 * Runs a procedure's Wrap Up so it can never be skipped, and can never
 * mask the failure that brought us here.
 *
 * Every FN-06 Wrap Up empties the address book and signs out. That is not
 * cosmetic: these procedures run one at a time against a single shared
 * live account, so an address left behind or a session left signed in
 * corrupts whichever procedure runs next. The Wrap Up used to sit inside
 * withFailureEvidence, which rethrows — so any failed assertion skipped
 * cleanup entirely. Confirmed live on TP-06-001's first run: three
 * addresses left behind and the session never signed out.
 *
 * Call this from a `finally`. Two rules keep that safe:
 *   - assertions inside `fn` must use expect.soft(), so a Wrap Up finding
 *     still fails the procedure without throwing over the original error;
 *   - anything that throws anyway is captured as evidence rather than
 *     propagated, because an exception raised inside a `finally` REPLACES
 *     the error being handled and would hide the real failure.
 */
export async function runWrapUp(testInfo: TestInfo, label: string, fn: () => Promise<void>) {
  try {
    await test.step(label, fn);
  } catch (err) {
    await testInfo.attach('Wrap Up could not complete', {
      body:
        'The Wrap Up did not finish, so this account may still hold leftover addresses ' +
        'or a signed-in session. Reset it before running the next procedure.\n\n' +
        String(err),
      contentType: 'text/plain',
    });
  }
}

export type AddressInput = Partial<{
  firstName: string;
  lastName: string;
  company: string;
  address1: string;
  address2: string;
  city: string;
  country: string;
  province: string;
  zip: string;
  phone: string;
  setDefault: boolean;
}>;

/**
 * Opens the new-address form and fills only the fields present on
 * `values` — omitted fields are left exactly as the form renders them
 * (blank), which is what most TP-06-001/002/005 steps need (they test
 * one field's validation at a time, everything else populated). Country
 * is selected first, since selecting it is what triggers
 * Shopify.CountryProvinceSelector to show/hide the Province row before
 * province is set.
 *
 * Confirmed live (9 Aug): with the shorter waits this used to have, the
 * saved address intermittently came back with Address1/Address2 merged
 * and lowercased, even though the field held the correctly-cased value
 * right up until submit — happened on some runs and not others with
 * identical input, pointing at a race with some async normalization tied
 * to the country/province selection rather than a deterministic rule.
 * The longer settle waits below are the fix aimed at the actual race;
 * callers should still treat a saved address's casing/line-merging as
 * unverified rather than assume this fully eliminates it — see the
 * case-insensitive comparisons in the specs that read these fields back.
 */
export async function fillNewAddressForm(page: Page, addressBook: AddressBookPage, values: AddressInput) {
  await addressBook.addNewAddressLink.click();
  await page.waitForTimeout(300);

  if (values.country !== undefined) {
    await addressBook.countrySelect.selectOption({ label: values.country });
    await page.waitForTimeout(1200);
  }
  if (values.firstName !== undefined) await addressBook.firstNameField.fill(values.firstName);
  if (values.lastName !== undefined) await addressBook.lastNameField.fill(values.lastName);
  if (values.company !== undefined) await addressBook.companyField.fill(values.company);
  if (values.address1 !== undefined) await addressBook.address1Field.fill(values.address1);
  if (values.address2 !== undefined) await addressBook.address2Field.fill(values.address2);
  if (values.city !== undefined) await addressBook.cityField.fill(values.city);
  if (values.province !== undefined) {
    await addressBook.provinceSelect.selectOption({ label: values.province }).catch(() => {});
    await page.waitForTimeout(500);
  }
  if (values.zip !== undefined) await addressBook.zipField.fill(values.zip);
  if (values.phone !== undefined) await addressBook.phoneField.fill(values.phone);
  if (values.setDefault) await addressBook.setDefaultCheckbox.check();
  // Final settle before the caller submits, so any pending async work
  // tied to the fields above has a chance to finish first.
  await page.waitForTimeout(500);
}

/** Submits the (already-filled) new-address form and waits for the page to settle. */
export async function submitNewAddress(page: Page, addressBook: AddressBookPage) {
  await addressBook.addAddressButton.click();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(500);
}

/** SPR-20: records the full set of field values entered, before the save's outcome is checked. */
export async function recordAddressValuesEntered(testInfo: TestInfo, label: string, values: AddressInput) {
  const lines = Object.entries(values)
    .map(([field, value]) => `${field}: ${value}`)
    .join('\n');
  await testInfo.attach(`Field values entered — ${label}`, {
    body: lines || '(no fields set — all left as the form renders them)',
    contentType: 'text/plain',
  });
}

/**
 * Records whatever appears in an ARIA live/alert region, if anything —
 * used at every blocked-save step. Confirmed live: this theme's account
 * pages render no such region at all for a blocked new-address save (no
 * error element of any kind), so an empty result here is itself the
 * evidence for DEF-F6-01/DEF-F6-04/DEF-F6-05's "no error message" finding,
 * not a locator that failed to find its target.
 */
export async function recordValidationMessages(page: Page, testInfo: TestInfo, label: string) {
  const observed = (
    await page.locator('[role="alert"], [aria-live="polite"], [aria-live="assertive"]').allInnerTexts()
  )
    .map((t) => t.trim())
    .filter(Boolean);
  await testInfo.attach(`Messages — ${label}`, {
    body: observed.length ? observed.map((t) => `  - ${t}`).join('\n') : '  (none displayed)',
    contentType: 'text/plain',
  });
  return observed;
}

/**
 * SPR-22: empties the address book so each TC starts from the state it
 * requires rather than inheriting one left by an earlier TC. Deletes by
 * index 0 repeatedly rather than collecting ids up front, since the DOM
 * (and therefore every other card's index) re-renders after each delete.
 * Delete raises a real window.confirm(), auto-accepted here.
 */
export async function emptyAddressBook(page: Page, addressBook: AddressBookPage) {
  await addressBook.goto();
  let safety = 20;
  while ((await addressBook.addressCards.count()) > 0 && safety-- > 0) {
    page.once('dialog', (d) => d.accept());
    await addressBook.deleteLink(0).click();
    await page.waitForLoadState('domcontentloaded').catch(() => {});
    await page.waitForTimeout(500);
  }
}
