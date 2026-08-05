import { Page, Locator } from '@playwright/test';

/**
 * /search — three confirmed states, all distinguishable by exact text:
 *  - No query run: h1 "Search Results" + the paragraph "No search
 *    performed. If you are looking for something, please try our
 *    homepage" (the SPR-10 "no query was run" case).
 *  - Query executed with matches: #keyword reads "Showing results for
 *    {term}", followed by a reused .product-grid section.
 *  - Query executed with no matches: #keyword reads "No results found
 *    for {term}" instead — no .product-grid is rendered.
 *
 * The header and footer "Search" links are plain <a href="/search">
 * navigations outside the #product-search form, so they cannot carry
 * whatever was typed into the field via static markup alone. Whether
 * they execute a real query or land on the placeholder state above is
 * exactly what TP-03-005/006 step 5 records — don't assume either way.
 */
export class SearchResultsPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly keywordBanner: Locator;
  readonly noQueryMessage: Locator;
  readonly grid: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.locator('#page-content h1');
    this.keywordBanner = page.locator('#keyword');
    this.noQueryMessage = page.getByText('No search performed', { exact: false });
    this.grid = page.locator('.product-grid');
  }

  productLink(name: string): Locator {
    return this.grid.locator('a').filter({ has: this.page.locator('h3', { hasText: new RegExp(`^${name}$`) }) });
  }
}
