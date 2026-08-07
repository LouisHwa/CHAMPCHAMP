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
