import { test, expect } from '../../utils/pacedTest';
import { withFailureEvidence, recordUrl, captureFailureEvidence } from '../../utils/evidence';
import { ACCOUNT_TEST_DATA } from '../../fixtures/test-data';
import { CatalogPage } from '../../pages/CatalogPage';
import { startSignedInContext, runWrapUp, closeContextWithVideo } from './_helpers';

/**
 * TP-06-004 — Verify wishlist add, remove and view transitions across the
 * empty and populated states (TC-06-011).
 *
 * THIS PROCEDURE IS EXPECTED TO REPORT "FAIL", AND THAT IS THE CORRECT
 * RESULT — the feature under test does not exist on the store, so the
 * procedure genuinely does not pass. The Fail is cross-referenced to
 * DEF-F6-03 in the test log's Remark column.
 *
 * The failure lands at Set Up step 2 — DEF-F6-03 confirmed live
 * (9 Aug direct capture): the sidebar "Wish list" link is a dead in-page
 * anchor (href="#sauce-show-wish-list"); clicking it produces no page
 * change, no overlay, nothing — there is no wishlist page and no
 * add-to-wishlist control anywhere on the store. Per the TPS's own stop
 * condition, steps 4-8 (which all depend on a working wishlist) are never
 * attempted once that failure is recorded — they are logged as not
 * executed, not as further failures. The check below is written as a
 * genuine conditional rather than a hardcoded skip, so this procedure
 * would correctly exercise steps 4-8 if the underlying defect were ever
 * fixed.
 */
test.describe('FN-06 Account and Address Management', () => {
  test('TP-06-004 wishlist state transitions', async ({ browser }, testInfo) => {
    test.setTimeout(90_000);

    const { context, page, header, sidebar } = await startSignedInContext(browser, undefined, testInfo);
    const catalog = new CatalogPage(page);

    try {
    await withFailureEvidence(page, testInfo, 'TP-06-004 unexpected failure', async () => {
      await test.step('Set Up #1 — confirm TD-06-W1 and TD-06-W2 are present in the catalogue', async () => {
        await catalog.goto();
        await expect(catalog.productLink(ACCOUNT_TEST_DATA.wishlistItem1)).toBeVisible();
        await expect(catalog.productLink(ACCOUNT_TEST_DATA.wishlistItem2)).toBeVisible();
      });

      let wishlistWorking = false;

      await test.step('TC-06-011 #1 — open the wishlist page with an empty wishlist', async () => {
        await header.gotoHome();
        const urlBefore = page.url();
        await sidebar.wishListLink.click();
        const urlAfter = await recordUrl(page, testInfo, 'Wish list — Set Up step 2');

        const overlay = page.locator('[class*="overlay"], [class*="modal"], [role="dialog"]').first();
        const overlayVisible = await overlay.isVisible().catch(() => false);
        // A genuine navigation changes the path, not just the fragment —
        // urlAfter still starting with urlBefore's path+no-fragment form
        // means nothing actually opened.
        const navigatedToDistinctPage = new URL(urlAfter).pathname !== new URL(urlBefore).pathname;
        wishlistWorking = overlayVisible || navigatedToDistinctPage;

        await testInfo.attach('Wish list — URL before / after (including fragment)', {
          body: `before: ${urlBefore}\nafter:  ${urlAfter}`,
          contentType: 'text/plain',
        });
        await testInfo.attach('Wish list — page/overlay opened', {
          body: `overlay-like element visible: ${overlayVisible}\nnavigated to a distinct page: ${navigatedToDistinctPage}`,
          contentType: 'text/plain',
        });

        // Soft, not hard: this is EXPECTED to fail (DEF-F6-03, already
        // confirmed). A hard expect() here was confirmed live to throw and
        // skip the stop-condition branch AND Wrap Up entirely — the same
        // "unexpected"-looking bailout pattern found in TP-06-001's
        // TC-06-001 #4, except this one WAS anticipated and just used the
        // wrong assertion type. withFailureEvidence's catch+rethrow doesn't
        // distinguish an anticipated failure from a surprising one; only
        // expect.soft() lets execution continue past it.
        expect.soft(wishlistWorking, 'TPS expects the wishlist page to open showing an empty state; DEF-F6-03 contradicts this').toBe(true);
      });

      if (!wishlistWorking) {
        await test.step('Stop condition — Set Up step 2 did not produce its expected result (DEF-F6-03)', async () => {
          await captureFailureEvidence(page, testInfo, 'DEF-F6-03 — wishlist did not open');
          await testInfo.attach('Steps not executed', {
            body: 'Set Up steps 4-8 (TC-06-011 #2 through #6: add TD-06-W1, add TD-06-W2, view listed items, remove TD-06-W1, remove TD-06-W2) were not executed — halted by the stop condition against DEF-F6-03.',
            contentType: 'text/plain',
          });
        });
      } else {
        await test.step('TC-06-011 #2 — add TD-06-W1 to the wishlist from its product page', async () => {
          await catalog.goto();
          await catalog.productLink(ACCOUNT_TEST_DATA.wishlistItem1).click();
          await page.waitForLoadState('domcontentloaded');
          const wishlistButton = page.getByRole('button', { name: /wish ?list/i }).or(page.getByRole('link', { name: /wish ?list/i }));
          await wishlistButton.first().click();
          await page.waitForTimeout(500);
        });

        await test.step('TC-06-011 #3 — add TD-06-W2, a second distinct product, to the wishlist', async () => {
          await catalog.goto();
          await catalog.productLink(ACCOUNT_TEST_DATA.wishlistItem2).click();
          await page.waitForLoadState('domcontentloaded');
          const wishlistButton = page.getByRole('button', { name: /wish ?list/i }).or(page.getByRole('link', { name: /wish ?list/i }));
          await wishlistButton.first().click();
          await page.waitForTimeout(500);
        });

        await test.step('TC-06-011 #4 — wishlist page lists both saved items', async () => {
          await sidebar.wishListLink.click();
          await page.waitForLoadState('domcontentloaded');
          const bodyText = await page.locator('body').innerText();
          await testInfo.attach('Wishlist contents — TC-06-011 #4', { body: bodyText, contentType: 'text/plain' });
          expect(bodyText).toContain(ACCOUNT_TEST_DATA.wishlistItem1);
          expect(bodyText).toContain(ACCOUNT_TEST_DATA.wishlistItem2);
        });

        await test.step('TC-06-011 #5 — remove TD-06-W1, TD-06-W2 remains, wishlist stays populated', async () => {
          await page.getByRole('button', { name: new RegExp(`remove.*${ACCOUNT_TEST_DATA.wishlistItem1}`, 'i') }).click();
          await page.waitForTimeout(500);
          const bodyText = await page.locator('body').innerText();
          expect(bodyText).not.toContain(ACCOUNT_TEST_DATA.wishlistItem1);
          expect(bodyText).toContain(ACCOUNT_TEST_DATA.wishlistItem2);
        });

        await test.step('TC-06-011 #6 — remove TD-06-W2, the last item, wishlist returns to empty state', async () => {
          await page.getByRole('button', { name: new RegExp(`remove.*${ACCOUNT_TEST_DATA.wishlistItem2}`, 'i') }).click();
          await page.waitForTimeout(500);
          const bodyText = await page.locator('body').innerText();
          expect(bodyText).not.toContain(ACCOUNT_TEST_DATA.wishlistItem2);
        });
      }

    });
    } finally {
      await runWrapUp(testInfo, 'Wrap Up — sign out and return to the store home page', async () => {
        await header.gotoHome();
        await header.logOutLink.click();
        await page.waitForLoadState('domcontentloaded');
        await header.gotoHome();
      });
      await closeContextWithVideo(context, page, testInfo, 'TP-06-004');
    }
  });
});
