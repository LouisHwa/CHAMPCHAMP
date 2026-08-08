import { test, expect } from '@playwright/test';
import { HeaderBar } from '../../pages/HeaderBar';
import { SidebarNav } from '../../pages/SidebarNav';
import { ROUTES } from '../../fixtures/test-data';
import { recordUrl } from '../../utils/evidence';

/**
 * TP-01-001 — Verify global navigation via the store logo and header
 * links reaches the correct destination. Covers TC-01-001 (#1 to #7),
 * per the refined TPS FN-01 (adds the Wish list check as #6, pushing
 * Refer a friend to #7).
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

    await test.step('TC-01-001 #6 — Wish list control', async () => {
      // Wish list is, like Refer a friend, a mount point for the same
      // third-party Sauce widget (DEF-F6-03: "the Wishlist button opens
      // no wishlist page, and there is no way to add items to a
      // wishlist" — an already-confirmed FN-06 defect). The new TPS
      // wording is observational ("record whether... displayed"), so
      // this records evidence rather than hard-asserting a specific
      // outcome, matching how the Refer a friend step below is handled.
      await header.gotoHome();
      const urlBefore = page.url();
      await sidebar.wishListLink.click();
      const urlAfter = await recordUrl(page, testInfo, 'Wish list');

      const overlay = page.locator('[class*="overlay"], [class*="modal"], [role="dialog"]').first();
      const overlayVisible = await overlay.isVisible().catch(() => false);

      await testInfo.attach('Wish list — URL before / after (including fragment)', {
        body: `before: ${urlBefore}\nafter:  ${urlAfter}`,
        contentType: 'text/plain',
      });
      await testInfo.attach('Wish list — page/panel/overlay displayed', {
        body: `overlay-like element visible: ${overlayVisible}`,
        contentType: 'text/plain',
      });
      await testInfo.attach('Wish list — screenshot', {
        body: await page.screenshot({ fullPage: true }),
        contentType: 'image/png',
      });
    });

    await test.step('TC-01-001 #7 — Refer a friend control', async () => {
      // "Refer a friend" is a mount point for a third-party widget (Sauce)
      // whose script (sgmnt.min.js, loaded from a CloudFront CDN) 404s —
      // confirmed via curl and via window.Sauce.isReady never becoming
      // true even after a 15s wait. This is not a timing issue: the
      // widget can never attach a click handler because the script it
      // depends on no longer exists. Capture the script's response status
      // as hard evidence alongside the visual result, rather than relying
      // on a screenshot alone to prove the control is dead.
      const sauceScriptResponsePromise = page
        .waitForResponse((res) => res.url().includes('sgmnt.min.js'), { timeout: 15_000 })
        .catch(() => null);

      await header.gotoHome();
      const sauceScriptResponse = await sauceScriptResponsePromise;

      const urlBefore = page.url();
      await sidebar.referAFriendLink.click();
      const urlAfter = await recordUrl(page, testInfo, 'Refer a friend');

      // New TPS wording: if a referral link/shareable mechanism appears,
      // use it and check whether it resolves; otherwise record its
      // absence. Checked live each run rather than assumed dead, even
      // though the script-404 evidence below already explains why one
      // is not expected to appear.
      const shareableLink = page.locator('input[type="text"][value*="http"], a[href*="ref="], [class*="share"] a[href^="http"]').first();
      const mechanismProduced = await shareableLink.isVisible().catch(() => false);
      let resolvesLive = false;
      let mechanismHref: string | null = null;
      if (mechanismProduced) {
        mechanismHref = (await shareableLink.getAttribute('href')) ?? (await shareableLink.inputValue().catch(() => null));
        if (mechanismHref) {
          const popupPromise = page.context().waitForEvent('page', { timeout: 10_000 }).catch(() => null);
          await shareableLink.click().catch(() => {});
          const popup = await popupPromise;
          if (popup) {
            await popup.waitForLoadState('domcontentloaded', { timeout: 10_000 }).catch(() => {});
            resolvesLive = true;
            await popup.close();
          }
        }
      }

      await testInfo.attach('Refer a friend — third-party widget script (sgmnt.min.js)', {
        body: sauceScriptResponse
          ? `HTTP ${sauceScriptResponse.status()} ${sauceScriptResponse.statusText()} — a non-2xx response here means window.Sauce.isReady never becomes true, so the control's click handler is never attached regardless of wait time. Likely candidate for a defect log entry.`
          : 'Request to sgmnt.min.js was not observed within 15s of navigation.',
        contentType: 'text/plain',
      });
      await testInfo.attach('Refer a friend — shareable mechanism', {
        body: mechanismProduced
          ? `A referral/shareable mechanism was produced: ${mechanismHref ?? '(no href/value found)'}\nResolved to a live destination when used: ${resolvesLive}`
          : 'No referral link or other shareable mechanism was produced.',
        contentType: 'text/plain',
      });
      await testInfo.attach('Refer a friend — URL before / after (including fragment)', {
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
