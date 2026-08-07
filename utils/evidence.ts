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
 * Extracts the first money-shaped number out of a price string, e.g.
 * "£1,234.50" -> 1234.5, "GBP\n£65.00" -> 65. Matches a decimal token
 * (up to 2 fraction digits) rather than just stripping non-digit
 * characters, since some cost-summary cells were confirmed live to
 * carry a stray trailing digit outside the price itself (e.g. a hidden
 * quantity marker) that a blanket strip would otherwise fold in.
 */
export function parseMoney(text: string | null): number {
  if (!text) return NaN;
  const match = text.replace(/,/g, '').match(/-?\d+(?:\.\d{1,2})?/);
  return match ? parseFloat(match[0]) : NaN;
}

/**
 * Wraps a test.fail()-marked test body so a real, unrelated failure (e.g.
 * a Cloudflare interstitial instead of the expected defect) still leaves
 * evidence behind. test.fail() reports the FINAL test status as "passed"
 * once the wrapped assertion throws, which suppresses Playwright's
 * automatic screenshot/trace/video capture (only-on-failure never fires,
 * since Playwright doesn't consider the test to have failed). This was
 * caught in TP-04-009: the test was silently counted as "1 passed" while
 * having validated nothing, because the real failure was a Cloudflare
 * challenge page, not the documented defect. Every test.fail()-marked
 * test body must be wrapped in this.
 */
export async function withFailureEvidence(
  page: Page,
  testInfo: TestInfo,
  label: string,
  fn: () => Promise<void>,
) {
  try {
    await fn();
  } catch (err) {
    await captureFailureEvidence(page, testInfo, label);
    throw err;
  }
}
