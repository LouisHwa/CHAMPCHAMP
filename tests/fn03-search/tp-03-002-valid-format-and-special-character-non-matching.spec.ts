import { test, expect } from '@playwright/test';
import { HeaderBar } from '../../pages/HeaderBar';
import { SearchResultsPage } from '../../pages/SearchResultsPage';
import { SEARCH_TERMS } from '../../fixtures/test-data';
import { recordUrl } from '../../utils/evidence';

/**
 * TP-03-002 — Verify a valid-format term with no catalogue match returns
 * a clear no-results message, and that a special-character-only query
 * still executes as a real search. Covers TC-03-002 (#1) and TC-03-003
 * (#1) — merged per the refined TPS FN-03, replacing the old separate
 * TP-03-002/TP-03-003. Neither test case is expected to fail; they
 * share a single Set Up and are executed as one procedure, returning to
 * the home page between them per SPR-05.
 *
 * Exact message text confirmed via live capture: #keyword reads
 * "No results found for backpack" — distinct from the no-query-run
 * message ("No search performed..."), per SPR-10.
 *
 * TC-03-003's hard assertion is only that a query DID execute
 * (keywordBanner visible, not the no-query-run placeholder) — the one
 * unambiguous, documented expectation per the TCS's "valid partition"
 * note; the exact resulting message is recorded as evidence rather than
 * assumed.
 */
test.describe('FN-03 Product Search', () => {
  test('TP-03-002 valid-format and special-character non-matching terms', async ({ page }, testInfo) => {
    const header = new HeaderBar(page);
    const search = new SearchResultsPage(page);

    await test.step('Set Up — open the store home page', async () => {
      await header.gotoHome();
    });

    await test.step('TC-03-002 #1 — search "backpack" via search icon', async () => {
      await header.searchByIcon(SEARCH_TERMS.noMatch);
      await recordUrl(page, testInfo, 'Non-matching term search');
      await expect(page).toHaveURL(/\/search/);
    });

    await test.step('TC-03-002 #1 — verbatim no-results message', async () => {
      const messageText = await search.keywordBanner.textContent();
      await testInfo.attach('Results area — verbatim message', {
        body: messageText?.trim() ?? '(no #keyword element found)',
        contentType: 'text/plain',
      });
      await testInfo.attach('Results area — screenshot', {
        body: await page.locator('#page-content').screenshot(),
        contentType: 'image/png',
      });
      await expect(search.keywordBanner).toContainText('No results found');
      await expect(search.grid).toHaveCount(0);
    });

    await test.step('Reset — return to the store home page (SPR-05)', async () => {
      await header.gotoHome();
    });

    await test.step('TC-03-003 #1 — search "@#$%" via search icon', async () => {
      await header.searchByIcon(SEARCH_TERMS.specialCharsOnly);
      await recordUrl(page, testInfo, 'Special-character-only search');

      const messageText = await search.keywordBanner.textContent();
      await testInfo.attach('Results area — verbatim message', {
        body: messageText?.trim() ?? '(no #keyword element found)',
        contentType: 'text/plain',
      });
      await testInfo.attach('Results area — screenshot', {
        body: await page.locator('#page-content').screenshot(),
        contentType: 'image/png',
      });

      // A query was executed at all, per the TCS's "valid partition" note —
      // distinguishes this from the no-query-run placeholder state.
      await expect(search.keywordBanner).toBeVisible();
      await expect(search.noQueryMessage).not.toBeVisible();
    });

    await test.step('Wrap Up — return to the store home page', async () => {
      await header.gotoHome();
    });
  });
});
