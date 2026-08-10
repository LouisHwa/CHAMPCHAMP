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
 * Wraps a test.fail()-marked test body so a real, unrelated failure (e.g.
 * a Cloudflare interstitial instead of the expected defect) still leaves
 * evidence behind. test.fail() reports the FINAL test status as "passed"
 * once the wrapped assertion throws, which suppresses Playwright's
 * automatic screenshot/trace/video capture (only-on-failure never fires,
 * since Playwright doesn't consider the test to have failed). This was
 * caught in an earlier FN-04 run: the test was silently counted as
 * "passed" while having validated nothing, because the real failure was
 * a Cloudflare challenge page, not the documented defect. Every
 * test.fail()-marked test body must be wrapped in this.
 */
export async function withFailureEvidence(
  page: Page,
  testInfo: TestInfo,
  fn: () => Promise<void>,
) {
  try {
    await fn();
  } catch (err) {
    await captureFailureEvidence(page, testInfo, 'unexpected error');
    throw err;
  }
}
