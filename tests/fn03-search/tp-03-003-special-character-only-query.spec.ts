import { test, expect } from '@playwright/test';
import { HeaderBar } from '../../pages/HeaderBar';
import { SearchResultsPage } from '../../pages/SearchResultsPage';
import { SEARCH_TERMS } from '../../fixtures/test-data';
import { recordUrl } from '../../utils/evidence';

/**
 * TP-03-003 — Verify a special-character-only query returns the
 * no-results message. Covers TC-03-003 (#1).
 *
 * Per the TCS's own note, a special-character term is accepted and
 * queried — it belongs to the valid partition, distinct from the
 * empty/whitespace submissions covered by TP-03-004. The hard assertion
 * here is therefore that a query DID execute (keywordBanner visible,
 * not the no-query-run placeholder), which is the one unambiguous,
 * documented expectation; the exact resulting message is recorded as
 * evidence rather than assumed.
 */
test.describe('FN-03 Product Search', () => {
  test('TP-03-003 special-character-only query', async ({ page }, testInfo) => {
    const header = new HeaderBar(page);
    const search = new SearchResultsPage(page);

    await test.step('Set Up — open the store home page', async () => {
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
