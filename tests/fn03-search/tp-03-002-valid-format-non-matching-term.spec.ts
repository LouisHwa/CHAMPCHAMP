import { test, expect } from '@playwright/test';
import { HeaderBar } from '../../pages/HeaderBar';
import { SearchResultsPage } from '../../pages/SearchResultsPage';
import { SEARCH_TERMS } from '../../fixtures/test-data';
import { recordUrl } from '../../utils/evidence';

/**
 * TP-03-002 — Verify a valid-format term with no catalogue match returns
 * a clear no-results message. Covers TC-03-002 (#1 to #2).
 *
 * Exact message text confirmed via live capture: #keyword reads
 * "No results found for backpack" — distinct from the no-query-run
 * message ("No search performed..."), per SPR-10.
 */
test.describe('FN-03 Product Search', () => {
  test('TP-03-002 valid-format non-matching term', async ({ page }, testInfo) => {
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

    await test.step('TC-03-002 #2 — verbatim no-results message', async () => {
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

    await test.step('Wrap Up — return to the store home page', async () => {
      await header.gotoHome();
    });
  });
});
