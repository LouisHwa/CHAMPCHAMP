import { Page, Locator } from '@playwright/test';

/**
 * The native Shopify checkout ("Sauce Demo Checkout"), reached via
 * CartPage.checkoutButton. It's a single-page React checkout (Contact,
 * Delivery, Shipping method and Payment are all on one page, one "Pay
 * now" submit — there is no separate "continue to shipping/payment"
 * step). Class names are hashed and regenerated per build (e.g.
 * "_7ozb2u3"), and element IDs are generated per render (e.g.
 * "TextFieldP0-45"). NEVER locate on those IDs or classes.
 *
 * CONFIRMED LIVE PITFALL: every delivery/billing text field renders
 * TWICE in the DOM — the real, visible input (role=textbox, generated
 * id) plus a second, hidden autofill-only shadow input carrying the
 * SAME name attribute (id="autofill_<field>", aria-hidden="true",
 * tabindex="-1"). Locating by `input[name="..."]` therefore matches two
 * elements and throws a Playwright strict-mode error. Role/label-based
 * locators (getByRole('textbox', { name }) / getByLabel with exact)
 * resolve this correctly since aria-hidden elements are excluded from
 * the accessibility tree — always use those here, never `[name=]`.
 *
 * Confirmed: payment runs through Shopify's "Test Payment Gateway"
 * (Bogus Gateway), matching the TDS's "simulation value" language for
 * approved/declined/gateway-failure outcomes (TCON-05-019 to 021) — so
 * checkout IS automatable end to end.
 *
 * The card number, expiry, CVV and name-on-card fields are each a
 * cross-origin iframe hosted on checkout.pci.shopifyinc.com (Shopify's
 * PCI tokenization service), confirmed to be the SAME iframe document
 * mounted multiple times — each instance exposes every payment field,
 * but only the one matching its container's title is meant to be used.
 * The iframe's own id/name carry a per-render random hash — never
 * locate on those. The `title` attribute ("Field container for: Card
 * number") is the stable handle; within that frame, the field itself is
 * the textbox whose accessible name matches (confirmed live).
 *
 * Confirmed by an earlier live test order: entering "1" as the card
 * number was accepted outright (confirmation page read "•••• 1"), with
 * no length or Luhn rejection observed at that time. This is NOT yet in
 * the team's Defect Log (checked 2026-08-07: no FN-05 entries exist), so
 * TP-05 card-validation tests below hard-assert the TPS's documented
 * outcomes; if a run instead shows the Bogus Gateway silently accepting
 * an out-of-range/invalid value, that is new evidence for the log, not
 * a reason to assume failure.
 */
export class CheckoutPage {
  readonly page: Page;

  readonly signInLink: Locator;
  readonly emailField: Locator;

  readonly countrySelect: Locator;

  readonly shippingMethodSection: Locator;
  readonly costSummaryTable: Locator;
  readonly testPaymentGatewayButton: Locator;

  readonly billingAddressCheckbox: Locator;
  readonly billingAddressSection: Locator;
  readonly payNowButton: Locator;

  constructor(page: Page) {
    this.page = page;

    this.signInLink = page.getByRole('link', { name: 'Sign in' });
    // Confirmed unique — no autofill shadow duplicate for email.
    this.emailField = page.locator('input[name="email"]');

    // getByLabel matches the hidden autofill shadow input too (same
    // strict-mode duplicate issue as the text fields) — role-scoped to
    // the real <select> (combobox) avoids it.
    this.countrySelect = page.getByRole('combobox', { name: 'Country/Region' });

    this.shippingMethodSection = page.locator('h2', { hasText: 'Shipping method' }).locator('xpath=..');
    this.costSummaryTable = page.getByRole('table', { name: 'Cost summary' });
    this.testPaymentGatewayButton = page.getByRole('button', { name: 'Test Payment Gateway' });

    this.billingAddressCheckbox = page.getByRole('checkbox', { name: 'Use shipping address as billing address' });
    // Confirmed live: unchecking billingAddressCheckbox reveals a
    // "Billing address" heading followed by a second, separate set of
    // Country/Region + address fields (same labels/names as Delivery).
    this.billingAddressSection = page.locator(':is(h2, h3)', { hasText: 'Billing address' }).locator('xpath=..');
    this.payNowButton = page.getByRole('button', { name: 'Pay now' });
  }

  /**
   * Maps each field's visible label to its stable `name` attribute.
   * Field-name locators can't rely on role (textbox vs combobox toggles
   * live as the address-autocomplete widget activates) or getByLabel
   * (matches the hidden autofill shadow input too, since label
   * association ignores aria-hidden) — `[name=]:not([aria-hidden])`
   * is the one pattern confirmed to hit only the real, visible field.
   */
  private static readonly FIELD_NAMES: Record<string, string> = {
    'First name (optional)': 'firstName',
    'Last name': 'lastName',
    'Company (optional)': 'company',
    Address: 'address1',
    'Apartment, suite, etc. (optional)': 'address2',
    City: 'city',
    Postcode: 'postalCode',
    'Phone (optional)': 'phone',
  };

  /** Delivery-address fields, e.g. deliveryField('Last name'), deliveryField('Postcode'). */
  deliveryField(label: keyof typeof CheckoutPage.FIELD_NAMES): Locator {
    return this.page.locator(`input[name="${CheckoutPage.FIELD_NAMES[label]}"]:not([aria-hidden="true"])`);
  }

  /** Billing-address fields, shown once billingAddressCheckbox is unchecked. Same labels/shape as delivery. */
  billingField(label: keyof typeof CheckoutPage.FIELD_NAMES): Locator {
    return this.billingAddressSection.locator(`input[name="${CheckoutPage.FIELD_NAMES[label]}"]:not([aria-hidden="true"])`);
  }

  /** The Country/Region select within the (revealed) billing address section. */
  get billingCountrySelect(): Locator {
    return this.billingAddressSection.getByRole('combobox', { name: 'Country/Region' });
  }

  /** Card fields are cross-origin iframes; locate each by its stable title, not its hashed id. */
  cardFrame(fieldTitle: 'Card number' | 'Expiration date (MM / YY)' | 'Security code' | 'Name on card') {
    return this.page.frameLocator(`iframe[title="Field container for: ${fieldTitle}"]`);
  }

  /** The actual fillable field inside a card iframe — same iframe document exposes every field, only this one is meant to be used. */
  cardField(fieldTitle: 'Card number' | 'Expiration date (MM / YY)' | 'Security code' | 'Name on card'): Locator {
    return this.cardFrame(fieldTitle).getByRole('textbox', { name: fieldTitle });
  }

  /** Cost summary row cell, e.g. costSummaryRow('Subtotal'), costSummaryRow('Shipping'), costSummaryRow('Total'). */
  costSummaryRow(label: string): Locator {
    return this.costSummaryTable
      .getByRole('row')
      .filter({ has: this.page.getByRole('rowheader', { name: label, exact: true }) })
      .getByRole('cell');
  }

  /** A shipping method radio option by its visible name, e.g. shippingMethodOption('International Shipping'). */
  shippingMethodOption(name: string): Locator {
    return this.shippingMethodSection.getByRole('radio', { name: new RegExp(name) });
  }
}
