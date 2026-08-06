import { test, expect } from '@playwright/test';
import { HeaderBar } from '../../pages/HeaderBar';
import { SearchResultsPage } from '../../pages/SearchResultsPage';
import { SEARCH_TERMS } from '../../fixtures/test-data';
import { recordUrl } from '../../utils/evidence';

/**
 * TP-03-005 — Verify the header Search control executes a real search
 * using the field contents. Covers TC-03-005 (#1).
 *
 * Intercase dependency: TP-03-001 must have run (search icon returns
 * matching products for a valid term).
 *
 * EXPECTED TO FAIL, BY DESIGN — marked via test.fail() below. Confirmed
 * via live run: the header "Search" link is a plain <a href="/search">
 * sitting outside the #product-search form, so filling the field and
 * clicking it does not carry the value through — it lands on the "no
 * search performed" placeholder instead of running a query (query
 * executed: false, verified in the report). That contradicts the
 * objective's unambiguous expected outcome. test.fail() tells Playwright
 * this is a known failure, so CI stays green until the control actually
 * starts working (at which point the test unexpectedly passes and CI
 * flags that for review) — same reasoning as TP-02-003.
 */
test.describe('FN-03 Product Search', () => {
  test('TP-03-005 header Search control', async ({ page }, testInfo) => {
    test.fail(true, 'Confirmed: the header Search link cannot carry the field value (outside the form) and lands on the no-query-run placeholder instead.');

    const header = new HeaderBar(page);
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

    await test.step('TC-03-005 #1 — same term via the header Search control', async () => {
      await header.gotoHome();
      await header.searchField.fill(SEARCH_TERMS.headerFooterControlCheck);
      await header.searchLink.click();
      const url = await recordUrl(page, testInfo, 'Header Search control');

      const queryExecuted = await search.keywordBanner.isVisible();
      const results = queryExecuted ? await search.grid.locator('h3').allTextContents() : [];
      await testInfo.attach('Header Search control — outcome', {
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
