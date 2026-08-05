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
