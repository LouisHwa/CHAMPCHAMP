import { test, expect } from '../../utils/pacedTest';
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

    // The Wrap Up has to attach "the recorded destination URLs, the page
    // title recorded at Step 7, the responses recorded at Steps 8 and 9",
    // so each step keeps what it observed rather than only attaching it
    // in isolation. Set Up numbering follows the TPS: step 7 is Blog,
    // step 8 Wish list, step 9 Refer a friend.
    const destinations: string[] = [];
    let blogPageTitle = '';
    let wishListResponse = '(not recorded)';
    let referAFriendResponse = '(not recorded)';

    await test.step('Set Up — clear state, confirm no shopper signed in, open the store home page', async () => {
      // ENV-01: Playwright gives every test a fresh context, so cache and
      // cookies start empty. The TPS also asks to confirm no shopper
      // account is signed in — recorded here rather than assumed, since
      // "signed out" is a precondition of the whole procedure.
      await header.gotoHome();
      const url = await recordUrl(page, testInfo, 'home page');
      destinations.push(`Set Up (home): ${url}`);

      const signedOut = await header.logInLink.isVisible().catch(() => false);
      await testInfo.attach('ENV-01 precondition — no shopper account signed in', {
        body: `"Log In" control visible (i.e. signed out): ${signedOut}`,
        contentType: 'text/plain',
      });
      expect(signedOut, 'ENV-01: no shopper account should be signed in at Set Up').toBe(true);
    });

    await test.step('TC-01-001 #3 — Catalog link', async () => {
      await sidebar.catalogLink.click();
      destinations.push(`Catalog [#3]: ${await recordUrl(page, testInfo, 'Catalog')}`);
      await expect(page).toHaveURL(new RegExp(`${ROUTES.catalog}$`));
    });

    await test.step('TC-01-001 #1 — store logo returns to home', async () => {
      await header.logo.click();
      destinations.push(`Store logo [#1]: ${await recordUrl(page, testInfo, 'store logo')}`);
      await expect(page).toHaveURL(/sauce-demo\.myshopify\.com\/$/);
    });

    await test.step('TC-01-001 #5 — About Us link', async () => {
      await sidebar.aboutUsLink.click();
      destinations.push(`About Us [#5]: ${await recordUrl(page, testInfo, 'About Us')}`);
      await expect(page).toHaveURL(new RegExp(`${ROUTES.aboutUs}$`));
    });

    await test.step('TC-01-001 #2 — Home link from About Us', async () => {
      await sidebar.homeLink.click();
      destinations.push(`Home [#2]: ${await recordUrl(page, testInfo, 'Home')}`);
      await expect(page).toHaveURL(/sauce-demo\.myshopify\.com\/$/);
    });

    await test.step('TC-01-001 #4 — Blog link and destination page title', async () => {
      await sidebar.blogLink.click();
      destinations.push(`Blog [#4]: ${await recordUrl(page, testInfo, 'Blog')}`);
      blogPageTitle = await page.title();
      await testInfo.attach('Blog page title', {
        body: blogPageTitle,
        contentType: 'text/plain',
      });
      await expect(page).toHaveURL(new RegExp(ROUTES.blog));
      // TCS expected result: "the blog or news content page is displayed at
      // the expected URL, AND its page title matches the 'Blog' label of the
      // control used". The title was previously attached but never compared,
      // so a mismatch could not surface. DEF-F1-03 is logged against this
      // step's destination, so a failure here is the evidence for it.
      expect.soft(
        blogPageTitle.toLowerCase(),
        `TC-01-001 #4: the destination page title should match the "Blog" label of the control used — title read: "${blogPageTitle}"`,
      ).toContain('blog');
    });

    await test.step('TC-01-001 #6 — Wish list control', async () => {
      // Wish list is, like Refer a friend, a mount point for the same
      // third-party Sauce widget (DEF-F6-03: "the Wishlist button opens
      // no wishlist page, and there is no way to add items to a
      // wishlist" — an already-confirmed FN-06 defect, independently
      // reproduced there by TP-06-004).
      //
      // The TPS words this step observationally ("record whether...
      // displayed"), but the TCS states a definite expected result for it:
      // "The Wish list page is displayed, listing saved items or showing an
      // empty-wishlist state." Recording the observation without comparing
      // it to that expected result meant the procedure passed while the
      // store plainly did not meet it, so the assertion below closes that
      // gap. Soft, so #7 and the Wrap Up still run and the full evidence
      // set is captured.
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
      wishListResponse =
        `URL after click: ${urlAfter}\n` +
        `fragment appended: ${urlAfter.includes('#') ? urlAfter.slice(urlAfter.indexOf('#')) : '(none)'}\n` +
        `page, panel or overlay displayed: ${overlayVisible}`;
      destinations.push(`Wish list [#6]: ${urlAfter}`);
      await testInfo.attach('Wish list — page/panel/overlay displayed', {
        body: `overlay-like element visible: ${overlayVisible}`,
        contentType: 'text/plain',
      });
      // A genuine navigation changes the path; a fragment-only change means
      // nothing opened.
      const wishListOpened = overlayVisible || new URL(urlAfter).pathname !== new URL(urlBefore).pathname;
      expect.soft(
        wishListOpened,
        `TC-01-001 #6: TCS expects the Wish list page to be displayed, listing saved items or showing an empty-wishlist state (DEF-F6-03) — observed: ${wishListResponse.replace(/\n/g, '; ')}`,
      ).toBe(true);

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
      // TCS expected result: "A working referral mechanism is provided, for
      // example a shareable link, and the link produced is valid and
      // functional." The TPS wording is observational, but recording the
      // observation without comparing it to that expected result let the
      // procedure pass while no mechanism existed at all. DEF-F1-05 is
      // logged against this control, so a failure here is its evidence.
      // Soft, so the Wrap Up still runs.
      expect.soft(
        mechanismProduced && resolvesLive,
        `TC-01-001 #7: TCS expects a working referral mechanism whose link is valid and functional (DEF-F1-05) — mechanism produced: ${mechanismProduced}, resolved to a live destination: ${resolvesLive}`,
      ).toBe(true);

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

      referAFriendResponse =
        `URL after click: ${urlAfter}\n` +
        `fragment appended: ${urlAfter.includes('#') ? urlAfter.slice(urlAfter.indexOf('#')) : '(none)'}\n` +
        `referral link or shareable mechanism produced: ${mechanismProduced}\n` +
        (mechanismProduced
          ? `mechanism: ${mechanismHref ?? '(no href/value found)'}\nresolved to a live destination when used: ${resolvesLive}`
          : 'absence recorded, per the TPS ("Where none is produced, record its absence")');
      destinations.push(`Refer a friend [#7]: ${urlAfter}`);
    });

    await test.step('Wrap Up — return to the store home page, attach the recorded results', async () => {
      await header.gotoHome();
      const homeUrl = await recordUrl(page, testInfo, 'Wrap Up — store home page');

      // The TPS Wrap Up asks for the recorded destination URLs, the page
      // title from Set Up step 7 (Blog), and the responses from steps 8 and
      // 9 (Wish list, Refer a friend) to be attached to the test log. Each
      // step already attaches its own evidence; this consolidates them into
      // one record so the log entry can be filled from a single attachment
      // rather than by reassembling nine separate ones.
      await testInfo.attach('TP-01-001 Wrap Up — recorded results', {
        body:
          `DESTINATION URLs RECORDED\n${destinations.map((d) => `  ${d}`).join('\n')}\n` +
          `  Wrap Up (home): ${homeUrl}\n\n` +
          `PAGE TITLE AT SET UP STEP 7 (Blog)\n  ${blogPageTitle || '(not recorded)'}\n\n` +
          `RESPONSE AT SET UP STEP 8 (Wish list)\n${wishListResponse.split('\n').map((l) => `  ${l}`).join('\n')}\n\n` +
          `RESPONSE AT SET UP STEP 9 (Refer a friend)\n${referAFriendResponse.split('\n').map((l) => `  ${l}`).join('\n')}\n\n` +
          'Screenshots captured under SPR-04 are attached to their own steps above.',
        contentType: 'text/plain',
      });
    });
  });
});
