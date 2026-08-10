import { Page, Locator } from '@playwright/test';

/**
 * Public order-status page, reached from the confirmation email's "View
 * your order" link without signing in. Confirmed live (9 Aug): this
 * redirects to a DIFFERENT domain entirely — shopify.com/<shop-id>/account
 * /orders/<id> (Shopify's newer centralized "Shop" order-status app), not
 * a page under sauce-demo.myshopify.com. It's a client-rendered SPA: the
 * initial response is just a "Loading order details" skeleton, so
 * `waitUntil: 'domcontentloaded'` alone is confirmed live to leave the
 * page in that skeleton state — waitForLoaded() below must be awaited
 * before reading any content from this page.
 *
 * Confirmed live: once loaded, the page reads (in order) Order #, status
 * ("Confirmed"/fulfillment status), a "Buy again" link/button, an Order
 * items list (Quantity / product name / variant on its own line / price),
 * Order totals (Subtotal/Shipping/Total), and Order details (Contact,
 * Ship to, Method, Payment). buyAgainControl matched "Buy again" exactly
 * on the first live run.
 */
export class OrderStatusPage {
  readonly page: Page;
  readonly buyAgainControl: Locator;

  constructor(page: Page) {
    this.page = page;
    this.buyAgainControl = page.getByRole('link', { name: /buy again/i }).or(page.getByRole('button', { name: /buy again/i }));
  }

  /** Waits out the "Loading order details" skeleton state before the page is read. */
  async waitForLoaded(timeoutMs = 20_000) {
    await this.page.waitForLoadState('networkidle', { timeout: timeoutMs }).catch(() => {});
    await this.page
      .locator('body')
      .filter({ hasNotText: 'Loading order details' })
      .waitFor({ state: 'attached', timeout: timeoutMs })
      .catch(() => {});
  }

  /** e.g. section('Shipping address'), section('Payment method') */
  section(heading: string): Locator {
    return this.page.locator(':is(h2, h3)', { hasText: heading }).locator('xpath=..');
  }
}
