import { Page, Locator } from '@playwright/test';

/**
 * Order confirmation page shown after CheckoutPage.payNowButton succeeds
 * (confirmed: card number "1" -> approved, via the Bogus Gateway — see
 * CheckoutPage.ts). Same hashed-class caveats apply here; locators below
 * use role/text, never the generated classes.
 *
 * Each "Order details" field (Contact information, Shipping address,
 * Shipping method, Payment method, Billing address) is an <h3> heading
 * followed by its value inside a shared wrapper div, so section()
 * locates the wrapper for any of them uniformly rather than needing a
 * bespoke locator per field.
 */
export class ConfirmationPage {
  readonly page: Page;
  readonly confirmationNumber: Locator;
  readonly thankYouHeading: Locator;
  readonly viewAccountLink: Locator;
  readonly continueShoppingLink: Locator;

  constructor(page: Page) {
    this.page = page;
    this.confirmationNumber = page.getByText(/^Confirmation #/);
    this.thankYouHeading = page.getByRole('heading', { name: /^Thank you,/ });
    this.viewAccountLink = page.getByRole('link', { name: 'View account' });
    this.continueShoppingLink = page.getByRole('link', { name: 'Continue shopping' });
  }

  /** e.g. section('Shipping address'), section('Payment method') */
  section(heading: string): Locator {
    return this.page.locator('h3', { hasText: heading }).locator('xpath=..');
  }
}
