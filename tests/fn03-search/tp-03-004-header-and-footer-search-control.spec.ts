import { test, expect } from '@playwright/test';
import { HeaderBar } from '../../pages/HeaderBar';
import { Footer } from '../../pages/Footer';
import { SearchResultsPage } from '../../pages/SearchResultsPage';
import { SEARCH_TERMS } from '../../fixtures/test-data';
import { recordUrl } from '../../utils/evidence';

/**
 * TP-03-004 — Verify the header and footer Search controls each execute
 * a real search using the field contents. Covers TC-03-005 (#1) and
 * TC-03-006 (#1) — merged per the refined TPS FN-03, replacing the old
 * separate TP-03-005/TP-03-006.
 *
 * Intercase dependency: TP-03-001 must have run (search icon returns
 * matching products for a valid term).
 *
 * The refined document establishes the reference result set ONCE and
 * reuses it for both comparisons — "TC-03-001 confirms only that the
 * search icon executes a real query and does not submit this term, so
 * the reference set cannot be inherited from it" — unlike the old two
 * separate files, which each established their own identical reference
 * set.
 *
 * EXPECTED TO FAIL, BY DESIGN, on BOTH sections — marked via test.fail()
 * below. Confirmed via live run (same finding for both controls): the
 * header and footer "Search" links are each a plain <a href="/search">
 * sitting outside the #product-search form, so filling the field and
 * clicking either does not carry the value through — both land on the
 * "no search performed" placeholder instead of running a query (query
 * executed: false, verified in the report). That contradicts the
 * objective's unambiguous expected outcome for both TCs. test.fail()
 * tells Playwright this is a known failure, so CI stays green until the
 * controls actually start working (at which point the test unexpectedly
 * passes and CI flags that for review) — same reasoning as TP-02-003.
 */
test.describe('FN-03 Product Search', () => {
  test('TP-03-004 header and footer Search control', async ({ page }, testInfo) => {
    test.fail(true, 'Confirmed: the header and footer Search links cannot carry the field value (outside the form) and land on the no-query-run placeholder instead.');

    const header = new HeaderBar(page);
    const footer = new Footer(page);
    const search = new SearchResultsPage(page);

    let referenceResults: string[] = [];

    await test.step('Set Up — reference result set via search icon (shared by both comparisons)', async () => {
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
      expect(results.sort()).toEqual([...referenceResults].sort());
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
      expect(results.sort()).toEqual([...referenceResults].sort());
    });

    await test.step('Wrap Up — return to the store home page', async () => {
      await header.gotoHome();
    });
  });
});
