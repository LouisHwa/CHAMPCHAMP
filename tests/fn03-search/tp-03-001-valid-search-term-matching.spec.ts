import { test, expect } from '../../utils/pacedTest';
import { HeaderBar } from '../../pages/HeaderBar';
import { CatalogPage } from '../../pages/CatalogPage';
import { SearchResultsPage } from '../../pages/SearchResultsPage';
import { PRODUCTS, SEARCH_TERMS } from '../../fixtures/test-data';
import { recordUrl } from '../../utils/evidence';

/**
 * TP-03-001 — Verify a valid search term returns the matching products,
 * including exact name, partial keyword and metadata matches. Covers
 * TC-03-001 (#1 to #3). Uses the magnifying-glass search icon only.
 *
 * The partial-keyword check (#2) asserts only that the two "jacket"
 * products are present, not that the result set is limited to them —
 * an earlier capture of this exact query returned 6 of 7 catalogue
 * products (everything except Bronze sandals), well beyond a literal
 * name match. Whether that breadth is intentional (fuzzy/tag-based
 * search) or a data quality issue is a judgement call for whoever owns
 * FN-03, not something to assert either way here. The full result set
 * is still attached for that review.
 *
 * #3 (the metadata/synonym term) asserts that a query actually ran and
 * that it matched at least one product. Its outcome against the live
 * store is UNVERIFIED: FN-03 has no recorded runs in the report history,
 * so unlike DEF-F2-01 there is no evidence here either way. If #3 fails,
 * check the attached result set before recording a defect — it may mean
 * TD-03-C no longer matches anything, in which case ENV-09 is unmet and
 * the term should be rebound in TPS Table 2.3a rather than a defect
 * raised (A-004).
 */
test.describe('FN-03 Product Search', () => {
  test('TP-03-001 valid search term matching', async ({ page }, testInfo) => {
    const header = new HeaderBar(page);
    const catalog = new CatalogPage(page);
    const search = new SearchResultsPage(page);

    await test.step('Set Up — record the catalogue reference listing', async () => {
      await catalog.goto();
      const referenceListing = await catalog.grid.locator('h3').allTextContents();
      await testInfo.attach('Catalogue reference listing (A-004)', {
        body: referenceListing.join('\n'),
        contentType: 'text/plain',
      });
    });

    await test.step('TC-03-001 #1 — exact name "Grey Jacket"', async () => {
      await header.gotoHome();
      await header.searchByIcon(SEARCH_TERMS.exactMatch);
      await recordUrl(page, testInfo, 'Exact match search');
      const results = await search.grid.locator('h3').allTextContents();
      await testInfo.attach('Query: "Grey Jacket" — results (search icon)', {
        body: results.join('\n'),
        contentType: 'text/plain',
      });
      expect(results).toContain(PRODUCTS.greyJacket);
    });

    await test.step('TC-03-001 #2 — partial keyword "jacket"', async () => {
      await header.gotoHome();
      await header.searchByIcon(SEARCH_TERMS.partialKeyword);
      await recordUrl(page, testInfo, 'Partial keyword search');
      const results = await search.grid.locator('h3').allTextContents();
      await testInfo.attach('Query: "jacket" — results (search icon)', {
        body: results.join('\n'),
        contentType: 'text/plain',
      });
      expect(results).toContain(PRODUCTS.greyJacket);
      expect(results).toContain(PRODUCTS.noirJacket);
    });

    await test.step('TC-03-001 #3 — metadata/synonym term "glasses"', async () => {
      await header.gotoHome();
      await header.searchByIcon(SEARCH_TERMS.metadataMatch);
      await recordUrl(page, testInfo, 'Metadata match search');
      const queryExecuted = await search.keywordBanner.isVisible();
      const keywordText = await search.keywordBanner.textContent();
      const results = await search.grid.locator('h3').allTextContents();
      await testInfo.attach('Query: "glasses" — banner / results (search icon)', {
        body:
          `banner: ${keywordText?.trim()}\n` +
          `query executed: ${queryExecuted}\n` +
          `products returned: ${results.length}\n` +
          `results:\n${results.join('\n')}`,
        contentType: 'text/plain',
      });

      // This step previously recorded the banner and results and asserted
      // NOTHING, so it passed whatever "glasses" returned — including
      // nothing at all. The objective is to verify a valid term returns
      // matching products "including exact name, partial keyword and
      // metadata matches", so the metadata match has to be checked, not
      // just captured. Soft, so the Wrap Up still runs and the evidence
      // above lands in the report either way.
      expect
        .soft(queryExecuted, 'TC-03-001 #3 expects TD-03-C to run a real catalogue query, not the no-query-run placeholder.')
        .toBe(true);
      expect
        .soft(results.length, 'TC-03-001 #3 expects TD-03-C (a metadata/synonym term) to match at least one product — ENV-09 binds the baseline catalogue so that a metadata term matches at least one product.')
        .toBeGreaterThan(0);
    });

    await test.step('Wrap Up — return to the store home page', async () => {
      await header.gotoHome();
    });
  });
});
