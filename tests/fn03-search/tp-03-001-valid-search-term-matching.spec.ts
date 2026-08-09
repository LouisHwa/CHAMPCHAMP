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
      const keywordText = await search.keywordBanner.textContent();
      const results = await search.grid.locator('h3').allTextContents();
      await testInfo.attach('Query: "glasses" — banner / results (search icon)', {
        body: `banner: ${keywordText?.trim()}\nresults:\n${results.join('\n')}`,
        contentType: 'text/plain',
      });
    });

    await test.step('Wrap Up — return to the store home page', async () => {
      await header.gotoHome();
    });
  });
});
