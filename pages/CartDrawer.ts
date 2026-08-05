import { Page, Locator } from '@playwright/test';

/**
 * The minicart drawer opened via HeaderBar.cartToggle. Each line is a
 * .row inside #drawer's <form>; size/colour are read from the row's <h3>
 * link text (e.g. "Noir jacket - M / Blue" pattern), since there's no
 * dedicated size/colour column.
 *
 * No order/subtotal total appeared anywhere in the drawer markup — only
 * each line's own total. TP-04-001's "order total" will need the full
 * /cart page instead; not needed for FN-01 to FN-03.
 */
export class CartDrawer {
  readonly page: Page;
  readonly drawer: Locator;
  readonly rows: Locator;
  readonly checkoutButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.drawer = page.locator('#drawer');
    this.rows = this.drawer.locator('.row');
    this.checkoutButton = this.drawer.getByRole('button', { name: 'Check Out' });
  }

  async open() {
    await this.page.locator('#minicart a.toggle-drawer.cart.desktop').click();
    await this.drawer.waitFor({ state: 'visible' });
  }

  async lineCount(): Promise<number> {
    return this.rows.count();
  }

  lineDescription(index: number): Locator {
    return this.rows.nth(index).locator('h3');
  }

  lineTotal(index: number): Locator {
    return this.rows.nth(index).locator('.total.desktop');
  }

  removeLine(index: number): Locator {
    return this.rows.nth(index).locator('a.removeLine');
  }
}
