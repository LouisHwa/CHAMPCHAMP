import { Page, Locator } from '@playwright/test';

/**
 * The native Shopify checkout ("Sauce Demo Checkout"), reached via
 * CartPage.checkoutButton. It's a separate React app layered over the
 * storefront theme — class names are hashed and regenerated per build
 * (e.g. "_7ozb2u3"), and element IDs are generated per render (e.g.
 * "TextFieldP0-45", "SelectP0-43"). NEVER locate on those IDs or
 * classes; they will not survive a redeploy, and may not even survive a
 * second page load. The `name` attributes below (used for browser
 * autofill, so unlikely to change) are stable and confirmed from a live
 * capture.
 *
 * Confirmed: payment runs through Shopify's "Test Payment Gateway"
 * (Bogus Gateway), matching the TDS's "simulation value" language for
 * approved/declined/gateway-failure outcomes (TCON-05-019 to 021) — so
 * checkout IS automatable end to end.
 *
 * The card number, expiry, CVV and name-on-card fields are each a
 * cross-origin iframe hosted on checkout.pci.shopifyinc.com (Shopify's
 * PCI tokenization service). Their iframe id/name attributes contain a
 * per-render random hash (e.g. "card-fields-number-4wms06n3d4x00000") —
 * never locate on those. The `title` attribute ("Field container for:
 * Card number") is the stable handle, hence the frameLocator-by-title
 * pattern below.
 *
 * Confirmed by an actual test order: entering "1" as the card number is
 * accepted outright (the resulting confirmation page's Payment method
 * read "•••• 1"), with no length or Luhn rejection. This contradicts the
 * TDS's card-number length/Luhn equivalence partitions (TCON-05-007 to
 * 012, e.g. 16-digit Luhn-valid numbers) at face value — the live Bogus
 * Gateway accepts a single digit as the full card number. Raise this
 * with whoever owns FN-05's test data before TP-05 is written; those
 * partitions may not be exercisable as documented.
 *
 * The Pay Now button's id (#checkout-pay-button) is a functional/analytics
 * hook rather than a generated form-field id, so unlike the text fields
 * it's used directly below alongside its accessible name.
 */
export class CheckoutPage {
  readonly page: Page;

  readonly orderSummaryToggle: Locator;
  readonly signInLink: Locator;
  readonly emailField: Locator;

  readonly countrySelect: Locator;
  readonly firstNameField: Locator;
  readonly lastNameField: Locator;
  readonly companyField: Locator;
  readonly addressField: Locator;
  readonly address2Field: Locator;
  readonly cityField: Locator;
  readonly postalCodeField: Locator;
  readonly phoneField: Locator;

  readonly shippingMethods: Locator;
  readonly testPaymentGatewayButton: Locator;

  readonly billingAddressCheckbox: Locator;
  readonly payNowButton: Locator;

  constructor(page: Page) {
    this.page = page;

    this.orderSummaryToggle = page.getByRole('button', { name: 'Order summary' });
    this.signInLink = page.getByRole('link', { name: 'Sign in' });
    this.emailField = page.locator('input[name="email"]');

    this.countrySelect = page.locator('select[name="countryCode"]');
    this.firstNameField = page.locator('input[name="firstName"]');
    this.lastNameField = page.locator('input[name="lastName"]');
    this.companyField = page.locator('input[name="company"]');
    this.addressField = page.locator('input[name="address1"]');
    this.address2Field = page.locator('input[name="address2"]');
    this.cityField = page.locator('input[name="city"]');
    this.postalCodeField = page.locator('input[name="postalCode"]');
    this.phoneField = page.locator('input[name="phone"]');

    this.shippingMethods = page.locator('#shipping_methods');
    this.testPaymentGatewayButton = page.getByRole('button', { name: 'Test Payment Gateway' });

    this.billingAddressCheckbox = page.locator('#billingAddressCheckbox');
    this.payNowButton = page.getByRole('button', { name: 'Pay now' });
  }

  /** Card fields are cross-origin iframes; locate each by its stable title, not its hashed id. */
  cardFrame(fieldTitle: 'Card number' | 'Expiration date (MM / YY)' | 'Security code' | 'Name on card') {
    return this.page.frameLocator(`iframe[title="Field container for: ${fieldTitle}"]`);
  }
}
