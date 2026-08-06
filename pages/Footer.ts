import { Page, Locator } from '@playwright/test';

/**
 * TP-01-004: the "Sauce" and "Shopping Cart by Shopify" footer links.
 * TP-03-006: the footer "Search" control.
 *
 * The footer actually has two "Search" links (an upper nav block under an
 * <h2>Footer</h2> heading, and a lower legal-row nav) — the TP doesn't
 * distinguish between them, so searchLink takes the first and that
 * ambiguity is documented rather than silently resolved.
 */
export class Footer {
  readonly page: Page;
  readonly sauceLink: Locator;
  readonly shoppingCartByShopifyLink: Locator;
  readonly searchLink: Locator;

  constructor(page: Page) {
    this.page = page;
    const footer = page.locator('footer');
    this.sauceLink = footer.getByRole('link', { name: 'Sauce', exact: true });
    this.shoppingCartByShopifyLink = footer.getByRole('link', { name: 'Shopping Cart by Shopify' });
    this.searchLink = footer.getByRole('link', { name: 'Search', exact: true }).first();
  }
}
