import { Page, Locator } from '@playwright/test';

/** TP-01-004: the "Sauce" and "Shopping Cart by Shopify" footer links. */
export class Footer {
  readonly page: Page;
  readonly sauceLink: Locator;
  readonly shoppingCartByShopifyLink: Locator;

  constructor(page: Page) {
    this.page = page;
    const footer = page.locator('footer');
    this.sauceLink = footer.getByRole('link', { name: 'Sauce', exact: true });
    this.shoppingCartByShopifyLink = footer.getByRole('link', { name: 'Shopping Cart by Shopify' });
  }
}
