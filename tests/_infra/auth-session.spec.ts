import { test, expect } from '@playwright/test';
import { recordUrl } from '../../utils/evidence';

/**
 * NOT a test procedure — this verifies the auth infrastructure itself, and
 * discharges no TCS coverage item. It lives under tests/_infra so it is
 * obvious it should be excluded from a compliance run.
 *
 * The store's login form is hCaptcha-protected and rejects any browser
 * Playwright drives (confirmed against bundled Chromium and real Chrome), so
 * the signed-in session is established by a human in a normal browser and
 * transplanted via playwright/.auth/user.json. This checks that transplant
 * actually works before any signed-in procedure depends on it.
 *
 * It also answers a live test-design question: whether a transplanted
 * session survives a sign-out. TC-04-013 #3 and TC-04-011 #4 require signing
 * back in after signing out, and if the saved state dies with the sign-out,
 * reloading it cannot stand in for that step.
 *
 * DESTRUCTIVE: signing out invalidates the captured session, so
 * user.json must be re-captured after running this.
 */
test.use({ storageState: 'playwright/.auth/user.json' });

test.describe('Auth infrastructure (not a TP)', () => {
  test('transplanted session starts signed in, and sign-out ends it', async ({ page, browser }, testInfo) => {
    // #customer_logout_link appears twice (header and sidebar). Duplicate
    // entry points are recorded as out of scope by SPR-06, so this scopes to
    // the first rather than treating the duplication as a defect.
    const logOutLink = page.locator('#customer_logout_link').first();
    const passwordField = page.locator('input[type="password"]');

    await test.step('Start state — the transplanted session is signed in', async () => {
      await page.goto('/account', { waitUntil: 'domcontentloaded' });
      const url = await recordUrl(page, testInfo, 'account page with transplanted session');

      await expect(logOutLink).toBeVisible();
      await expect(passwordField).toHaveCount(0);

      await testInfo.attach('Signed-in start state', {
        body: `destination: ${url}\nlog out control visible: true\npassword field present: false`,
        contentType: 'text/plain',
      });
    });

    await test.step('Sign out — the session ends without touching the login form', async () => {
      await logOutLink.click();
      await page.waitForURL((u) => !u.pathname.startsWith('/account') || u.pathname === '/account/login');
      const url = await recordUrl(page, testInfo, 'after sign out');

      await page.goto('/account', { waitUntil: 'domcontentloaded' });
      const signedOut = (await passwordField.count()) > 0 || page.url().includes('/account/login');

      await testInfo.attach('Signed-out state', {
        body: `destination after sign out: ${url}\n/account now shows a login form: ${signedOut}`,
        contentType: 'text/plain',
      });
      expect(signedOut).toBe(true);
    });

    await test.step('Saved session after sign-out — can it be reused for a second sign-in?', async () => {
      // A fresh context loading the SAME file. If this still comes up signed
      // in, the saved cookie outlived the sign-out; if it does not, then
      // TC-04-013 #3 / TC-04-011 #4 cannot be satisfied by reloading it.
      const secondContext = await browser.newContext({ storageState: 'playwright/.auth/user.json' });
      const secondPage = await secondContext.newPage();
      await secondPage.goto('https://sauce-demo.myshopify.com/account', { waitUntil: 'domcontentloaded' });

      const stillSignedIn =
        (await secondPage.locator('#customer_logout_link').count()) > 0 &&
        (await secondPage.locator('input[type="password"]').count()) === 0;

      await testInfo.attach('Reusing the saved session after sign-out', {
        body:
          `destination: ${secondPage.url()}\n` +
          `saved session still signed in: ${stillSignedIn}\n\n` +
          (stillSignedIn
            ? 'The saved cookie outlived the sign-out.'
            : 'The saved cookie died with the sign-out, so it cannot stand in for a second sign-in ' +
              '(TC-04-013 #3, TC-04-011 #4). Those steps need the login form, which is captcha-protected.'),
        contentType: 'text/plain',
      });

      await secondContext.close();
    });
  });
});
