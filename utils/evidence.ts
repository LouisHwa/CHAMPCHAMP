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

/** Resolves to `fallback` if `promise` has not settled within `ms`, for probing a page that may be hung. */
async function withinTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise.catch(() => fallback),
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

/**
 * SPR-14: record whether the page remains responsive after a step that may
 * crash it, and capture its state if it fails.
 *
 * A hung page cannot be evidenced the usual way. Playwright's automatic
 * screenshot is keyed to the test's final status, which test.fail() reports
 * as "passed", so it never fires; and page.screenshot() on a dead page hangs
 * as well. Everything here is therefore bounded by its own timeout, and a
 * capture that fails is recorded as a result rather than swallowed — a
 * screenshot that cannot be taken is itself evidence the page stopped
 * responding, and Chromium's own crash page ("Aw, Snap") screenshots fine,
 * which is usually the picture worth having.
 */
export async function captureCrashEvidence(
  page: Page,
  testInfo: TestInfo,
  label: string,
  timeout = 5_000,
): Promise<void> {
  const closed = page.isClosed();
  let screenshotCaptured = false;

  if (!closed) {
    try {
      await testInfo.attach(`Screenshot — ${label}`, {
        body: await page.screenshot({ timeout }),
        contentType: 'image/png',
      });
      screenshotCaptured = true;
    } catch {
      // Deliberately swallowed: reported below as evidence in its own right.
    }
  }

  const readyState = closed
    ? '(page closed)'
    : await withinTimeout(
        page.evaluate(() => document.readyState),
        timeout,
        '(no response within timeout — page unresponsive)',
      );

  await testInfo.attach(`Page state — ${label}`, {
    body:
      `page closed: ${closed}\n` +
      `screenshot captured: ${screenshotCaptured}${screenshotCaptured ? '' : ' (capture itself timed out — page unresponsive)'}\n` +
      `document.readyState: ${readyState}\n` +
      `URL: ${closed ? '(unavailable)' : page.url()}`,
    contentType: 'text/plain',
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
