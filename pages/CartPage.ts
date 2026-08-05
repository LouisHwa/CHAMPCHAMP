import { Page, Locator } from '@playwright/test';

/**
 * /cart — the full cart page, distinct from the minicart drawer
 * (CartDrawer.ts). Unlike the drawer, this has an order note field and
 * an explicit order total, both needed for TP-04-001 (SPR-01/04/05/06/
 * 12/13). Line rows are matched by containing the quantity input, since
 * the "total" summary div also carries a .row class and would otherwise
 * be mismatched as a line.
 */
export class CartPage {
  readonly page: Page;
  readonly rows: Locator;
  readonly orderTotal: Locator;
  readonly noteField: Locator;
  readonly updateButton: Locator;
  readonly checkoutButton: Locator;
  readonly continueShoppingLink: Locator;

  constructor(page: Page) {
    this.page = page;
    this.rows = page.locator('#cart .row').filter({ has: page.locator('input[name="updates[]"]') });
    this.orderTotal = page.locator('.cart.total h2');
    this.noteField = page.locator('#note');
    this.updateButton = page.locator('#update');
    this.checkoutButton = page.locator('#checkout');
    this.continueShoppingLink = page.locator('.continue-shopping a');
  }

  async goto() {
    await this.page.goto('/cart');
  }

  async lineCount(): Promise<number> {
    return this.rows.count();
  }

  lineDescription(index: number): Locator {
    return this.rows.nth(index).locator('h3');
  }

  lineQuantityInput(index: number): Locator {
    return this.rows.nth(index).locator('input[name="updates[]"]');
  }

  lineTotal(index: number): Locator {
    return this.rows.nth(index).locator('.total.desktop span');
  }

  removeLine(index: number): Locator {
    return this.rows.nth(index).locator('.remove a');
  }
}
