import { Page, TestInfo } from '@playwright/test';

/**
 * SPR-01: the destination URL shown in the address bar is recorded at
 * every navigation step. Attaching it to the test report means the
 * evidence lands in the HTML/Allure report automatically instead of
 * living in someone's screenshot folder.
 */
export async function recordUrl(page: Page, testInfo: TestInfo, label: string) {
  const url = page.url();
  await testInfo.attach(`URL — ${label}`, {
    body: url,
    contentType: 'text/plain',
  });
  return url;
}

/**
 * SPR-04: screenshot plus destination URL wherever a step does not
 * produce its expected result. Call this in a catch block, or rely on
 * screenshot: 'only-on-failure' in playwright.config.ts for the
 * automatic version.
 */
export async function captureFailureEvidence(
  page: Page,
  testInfo: TestInfo,
  label: string,
) {
  await recordUrl(page, testInfo, `FAIL ${label}`);
  await testInfo.attach(`Screenshot — ${label}`, {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png',
  });
}

/**
 * Every page object navigates with waitUntil: 'domcontentloaded', because
 * this storefront's third-party trackers can hang the 'load' event past
 * navigationTimeout (see HeaderBar.gotoHome). The cost of that trade is
 * that images are still in flight when a step captures its evidence, so
 * screenshots and trace snapshots show a half-rendered page. Call this
 * immediately before capturing evidence to close that gap without
 * reintroducing the hang.
 *
 * Deliberately swallows its own timeout: the store carries several dead
 * or blocked third-party images, and one of them failing to load must not
 * fail a procedure whose expected result does not depend on it. Evidence
 * quality is best-effort; the assertions around it are not.
 */
export async function settleForEvidence(page: Page, timeout = 5_000) {
  await page
    .waitForFunction(
      () => Array.from(document.images).every((img) => img.complete && img.naturalWidth > 0),
      null,
      { timeout },
    )
    .catch(() => {});
}

/** Parses "£45.00" style money text into a plain number (45). Returns NaN if no amount is found. */
export function parseMoney(text: string | null): number {
  if (!text) return NaN;
  const match = text.replace(/,/g, '').match(/[\d.]+/);
  return match ? parseFloat(match[0]) : NaN;
}

/**
 * For test.fail()-marked tests only: Playwright's automatic
 * screenshot/trace/video capture is keyed to the test's FINAL outcome,
 * which test.fail() reports as "passed" (an expected failure) even when
 * the underlying assertion threw — so that automatic capture never
 * fires. If something unrelated to the intended defect breaks first
 * (confirmed to happen: a Cloudflare interstitial mid-test), there is
 * otherwise zero evidence of what actually went wrong. Wrap a
 * test.fail()-marked test's body in this so an unexpected failure still
 * leaves a screenshot, visible page text, and the error message behind,
 * regardless of Playwright's own capture settings.
 */
export async function withFailureEvidence(page: Page, testInfo: TestInfo, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (error) {
    await captureFailureEvidence(page, testInfo, 'unexpected error');
    await testInfo.attach('Unexpected failure — page text', {
      body: await page.locator('body').innerText().catch(() => '(could not read page text)'),
      contentType: 'text/plain',
    });
    await testInfo.attach('Unexpected failure — error message', {
      body: (error as Error).message,
      contentType: 'text/plain',
    });
    throw error;
  }
}
