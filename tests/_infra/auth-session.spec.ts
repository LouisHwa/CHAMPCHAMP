import { test, expect } from '@playwright/test';

/**
 * Infra check, not a TCS coverage item — confirms playwright/.auth/user.json
 * is a genuine signed-in session, that signing out is automatable (no
 * captcha on the way out), and that the saved session dies with that
 * sign-out rather than staying reusable. See auth-setup-guide.md.
 *
 * Excluded from the normal suite via the INFRA gate below. Running this
 * WILL invalidate your captured session — re-capture afterwards.
 *
 *   $env:INFRA=1; npx playwright test tests/_infra/auth-session.spec.ts --project=chromium
 *   $env:INFRA=""
 */
const STORAGE_STATE_PATH = 'playwright/.auth/user.json';

test.use({ storageState: STORAGE_STATE_PATH });

test.describe('_infra', () => {
  test('captured session signs out cleanly and cannot be reused afterwards', async ({ page, browser }) => {
    test.skip(!process.env.INFRA, 'Set INFRA=1 to run this infra-only check (see auth-setup-guide.md). Excluded from the normal suite — it discharges no TCS coverage item.');

    await test.step('the captured session starts signed in', async () => {
      await page.goto('/account', { waitUntil: 'domcontentloaded' });
      expect(page.url()).not.toContain('/account/login');
      await expect(page.locator('#customer_logout_link').first()).toBeVisible();
    });

    await test.step('signing out is automatable — no captcha on the way out', async () => {
      await page.locator('#customer_logout_link').first().click();
      await page.waitForLoadState('domcontentloaded');
      await expect(page.locator('#customer_login_link').first()).toBeVisible();
    });

    await test.step('the saved session file cannot be reused after that sign-out', async () => {
      const staleContext = await browser.newContext({ storageState: STORAGE_STATE_PATH });
      const stalePage = await staleContext.newPage();
      await stalePage.goto('/account', { waitUntil: 'domcontentloaded' });

      const stillSignedOut = stalePage.url().includes('/account/login')
        || !(await stalePage.locator('#customer_logout_link').first().isVisible().catch(() => false));
      await staleContext.close();

      expect(stillSignedOut).toBe(true);
    });
  });
});
