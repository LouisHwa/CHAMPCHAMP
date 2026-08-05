import { Page, Locator } from '@playwright/test';

/** /account — order history and the address-book entry point. */
export class MyAccountPage {
  readonly page: Page;
  readonly orderRows: Locator;
  readonly customerName: Locator;
  readonly addressesLink: Locator;

  constructor(page: Page) {
    this.page = page;
    this.orderRows = page.locator('.order-history tbody tr');
    this.customerName = page.locator('.customer-name');
    this.addressesLink = page.locator('.sidebar').getByRole('link', { name: /^Addresses \(\d+\)$/ });
  }

  async goto() {
    await this.page.goto('/account');
  }

  orderLink(index: number): Locator {
    return this.orderRows.nth(index).locator('a');
  }

  /** TCOV-06-024 to 026: the "Addresses (n)" counter itself, e.g. "Addresses (3)". */
  async addressesLabel(): Promise<string> {
    return (await this.addressesLink.textContent()) ?? '';
  }
}
