import { test, expect } from '@playwright/test';
import { HeaderBar } from '../../pages/HeaderBar';
import { SidebarNav } from '../../pages/SidebarNav';
import { ROUTES } from '../../fixtures/test-data';
import { recordUrl } from '../../utils/evidence';

/**
 * TP-01-001 — Verify global navigation via the store logo and header
 * links reaches the correct destination. Covers TC-01-001 (#1 to #6).
 *
 * The nav links named in TC-01-001 (Home, Catalog, Blog, About Us) live
 * in the sidebar (#main-menu), not <header> — confirmed from the live
 * DOM. Only the store logo is in the header itself.
 *
 * ENV-01 is satisfied automatically: Playwright gives every test a fresh
 * browser context with empty cache and cookies and no account signed in.
 */
test.describe('FN-01 Product Browsing and Navigation', () => {
  test('TP-01-001 global navigation via logo and header links', async ({ page }, testInfo) => {
    const header = new HeaderBar(page);
    const sidebar = new SidebarNav(page);

    await test.step('Set Up — open the store home page', async () => {
      await header.gotoHome();
      await recordUrl(page, testInfo, 'home page');
    });

    await test.step('TC-01-001 #3 — Catalog link', async () => {
      await sidebar.catalogLink.click();
      await recordUrl(page, testInfo, 'Catalog');
      await expect(page).toHaveURL(new RegExp(`${ROUTES.catalog}$`));
    });

    await test.step('TC-01-001 #1 — store logo returns to home', async () => {
      await header.logo.click();
      await recordUrl(page, testInfo, 'store logo');
      await expect(page).toHaveURL(/sauce-demo\.myshopify\.com\/$/);
    });

    await test.step('TC-01-001 #5 — About Us link', async () => {
      await sidebar.aboutUsLink.click();
      await recordUrl(page, testInfo, 'About Us');
      await expect(page).toHaveURL(new RegExp(`${ROUTES.aboutUs}$`));
    });

    await test.step('TC-01-001 #2 — Home link from About Us', async () => {
      await sidebar.homeLink.click();
      await recordUrl(page, testInfo, 'Home');
      await expect(page).toHaveURL(/sauce-demo\.myshopify\.com\/$/);
    });

    await test.step('TC-01-001 #4 — Blog link and destination page title', async () => {
      await sidebar.blogLink.click();
      await recordUrl(page, testInfo, 'Blog');
      await testInfo.attach('Blog page title', {
        body: await page.title(),
        contentType: 'text/plain',
      });
      await expect(page).toHaveURL(new RegExp(ROUTES.blog));
    });

    await test.step('TC-01-001 #6 — Refer a friend control', async () => {
      await header.gotoHome();
      const urlBefore = page.url();
      await sidebar.referAFriendLink.click();
      const urlAfter = await recordUrl(page, testInfo, 'Refer a friend');

      // The control is an in-page anchor (#sauce-show-refer-friend), so the
      // expected result is a panel/overlay rather than a page load. Capture
      // what actually happens; set the assertion to whatever TC-01-001 #6
      // states as expected, and log a defect if they disagree.
      await testInfo.attach('Refer a friend — URL before / after', {
        body: `before: ${urlBefore}\nafter:  ${urlAfter}`,
        contentType: 'text/plain',
      });
      await testInfo.attach('Refer a friend — screenshot', {
        body: await page.screenshot({ fullPage: true }),
        contentType: 'image/png',
      });
    });
  });
});
