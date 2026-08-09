import { Page, Locator } from '@playwright/test';

/**
 * Order detail page, reached from My Account > "Your Orders" table >
 * order number link (MyAccountPage.orderLink) — confirmed live at
 * /account/orders/<id>, under the storefront domain (unlike the public
 * order-status page — see OrderStatusPage.ts, a completely different
 * shopify.com app). Confirmed live: renders order number, placed-on
 * timestamp, a "Billing Information" section and a "Payment Status"
 * section using the same heading-then-content shape as ConfirmationPage,
 * so section(heading) below reuses that proven pattern.
 */
export class OrderDetailPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /** e.g. section('Shipping address'), section('Payment method'), section('Billing address') */
  section(heading: string): Locator {
    return this.page.locator(':is(h2, h3)', { hasText: heading }).locator('xpath=..');
  }
}
