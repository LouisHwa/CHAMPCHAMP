import { test, expect } from '../../utils/pacedTest';
import { HeaderBar } from '../../pages/HeaderBar';
import { Footer } from '../../pages/Footer';
import { SearchResultsPage } from '../../pages/SearchResultsPage';
import { SEARCH_TERMS } from '../../fixtures/test-data';
import { recordUrl } from '../../utils/evidence';

/**
 * TP-03-006 — Verify the footer Search control executes a real search
 * using the field contents. Covers TC-03-006 (#1).
 *
 * Intercase dependency: TP-03-001 must have run (search icon returns
 * matching products for a valid term).
 *
 * EXPECTED TO FAIL, BY DESIGN — marked via test.fail() below. Same
 * finding as TP-03-005, confirmed via live run: the footer "Search" link
 * is a plain <a href="/search"> outside the #product-search form, so it
 * cannot carry the field's value — it lands on the "no search performed"
 * placeholder instead of running a query (query executed: false,
 * verified in the report). That contradicts the objective's unambiguous
 * expected outcome. test.fail() tells Playwright this is a known
 * failure, so CI stays green until the control actually starts working.
 */
test.describe('FN-03 Product Search', () => {
  test('TP-03-006 footer Search control', async ({ page }, testInfo) => {
    test.fail(true, 'Confirmed: the footer Search link cannot carry the field value (outside the form) and lands on the no-query-run placeholder instead.');

    const header = new HeaderBar(page);
    const footer = new Footer(page);
    const search = new SearchResultsPage(page);

    let referenceResults: string[] = [];

    await test.step('Set Up — reference result set via search icon', async () => {
      await header.gotoHome();
      await header.searchByIcon(SEARCH_TERMS.headerFooterControlCheck);
      referenceResults = await search.grid.locator('h3').allTextContents();
      await testInfo.attach('Reference result set (search icon, "sandals")', {
        body: referenceResults.join('\n'),
        contentType: 'text/plain',
      });
      expect(referenceResults.length).toBeGreaterThan(0);
    });

    await test.step('TC-03-006 #1 — same term via the footer Search control', async () => {
      await header.gotoHome();
      await header.searchField.fill(SEARCH_TERMS.headerFooterControlCheck);
      await footer.searchLink.scrollIntoViewIfNeeded();
      await footer.searchLink.click();
      const url = await recordUrl(page, testInfo, 'Footer Search control');

      const queryExecuted = await search.keywordBanner.isVisible();
      const results = queryExecuted ? await search.grid.locator('h3').allTextContents() : [];
      await testInfo.attach('Footer Search control — outcome', {
        body: `destination: ${url}\nquery executed: ${queryExecuted}\nresults:\n${results.join('\n')}`,
        contentType: 'text/plain',
      });

      // These assertions are expected to fail — see the file-level comment.
      expect(queryExecuted).toBe(true);
      expect(results.sort()).toEqual(referenceResults.sort());
    });

    await test.step('Wrap Up — return to the store home page', async () => {
      await header.gotoHome();
    });
  });
});
