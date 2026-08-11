import { Browser, Page, TestInfo, expect } from '@playwright/test';
import { HeaderBar } from '../../pages/HeaderBar';
import { CatalogPage } from '../../pages/CatalogPage';
import { ProductPage } from '../../pages/ProductPage';
import { CartPage } from '../../pages/CartPage';
import { CheckoutPage } from '../../pages/CheckoutPage';
import { PRODUCT_HANDLES } from '../../fixtures/test-data';
import { parseMoney } from '../../utils/evidence';

const STORAGE_STATE_PATH = 'playwright/.auth/user.json';
const BASE_URL = 'https://sauce-demo.myshopify.com';

/**
 * TD-05-BILL — a billing address differing from TD-05-UK in every
 * field, so a separately entered billing address can be told apart
 * from one reused from shipping (TP-05-005's TC-05-013 section).
 */
export const BILLING_ADDRESS = {
  firstName: 'Billing',
  lastName: 'Payer',
  address1: '10 Downing Street',
  city: 'London',
  postcode: 'SW1A 2AA',
};

/** TD-05-NOC — name on card, used wherever the card fields are filled. */
export const NAME_ON_CARD = 'Test User';

/**
 * Starts a browser context already signed in, standing in for a live
 * "sign in" step wherever a TC calls for one — the login form is
 * hCaptcha-protected and rejects any Playwright-driven browser
 * regardless of pacing (confirmed all session, see
 * auth-setup-guide.md). Needs a real, freshly captured
 * playwright/.auth/user.json to work — see that guide for the capture
 * steps. baseURL is passed explicitly since manually created contexts
 * don't inherit it from playwright.config.ts the way the default
 * page/context fixture does.
 */
export async function startSignedInContext(browser: Browser) {
  const context = await browser.newContext({ baseURL: BASE_URL, storageState: STORAGE_STATE_PATH });
  const page = await context.newPage();
  const header = new HeaderBar(page);
  const catalog = new CatalogPage(page);
  const product = new ProductPage(page);
  const cart = new CartPage(page);
  const checkout = new CheckoutPage(page);
  return { context, page, header, catalog, product, cart, checkout };
}

/**
 * Selects the first available size/colour variant if the product on
 * screen offers one, then adds it to the cart. Waits for the actual
 * /cart/add response, not just networkidle — with slowMo pacing in the
 * mix, networkidle alone was confirmed live to sometimes resolve before
 * the add-to-cart AJAX call completes, leaving the cart genuinely empty
 * at the next step. Shared by the first and (where needed) second
 * product added in addProductAndGoToCheckout / addSecondProduct below.
 */
async function selectVariantAndAddToCart(page: Page, product: ProductPage) {
  if ((await product.sizeSelect.count()) > 0 && (await product.sizeSelect.locator('option').count()) > 1) {
    const value = await product.sizeSelect.locator('option').nth(1).getAttribute('value');
    if (value) await product.selectSize(value);
  }
  if ((await product.colourSelect.count()) > 0 && (await product.colourSelect.locator('option').count()) > 1) {
    const value = await product.colourSelect.locator('option').nth(1).getAttribute('value');
    if (value) await product.selectColour(value);
  }

  const cartAddResponse = page.waitForResponse((r) => r.url().includes('/cart/add'), { timeout: 10_000 }).catch(() => null);
  await product.addToCartButton.click();
  await cartAddResponse;
}

/**
 * Adds TD-05-B (Bronze Sandals) to whatever cart is already open, via
 * its known handle rather than the catalog grid. Used wherever a step
 * needs a second item added without rebuilding the cart from scratch
 * (TP-05-005's reset before TC-05-009, TP-05-006's TC-05-010 #1).
 */
export async function addSecondProduct(page: Page) {
  const product = new ProductPage(page);
  await product.goto(PRODUCT_HANDLES.bronzeSandals);
  await selectVariantAndAddToCart(page, product);
}

/**
 * Shared FN-05 setup: empty-cart baseline (ENV-08) through to a fresh
 * checkout page. Home -> Catalog -> TD-05-A (Grey Jacket) -> select
 * first available size/colour if present -> Add to Cart -> /cart ->
 * #checkout -> the single-page Shopify checkout.
 *
 * TD-05-A is navigated to by its known handle (PRODUCT_HANDLES.greyJacket),
 * not the first catalogue grid tile — confirmed live (TP-05-002, 9 Aug)
 * that the grid's first tile is actually "Black heels", not "Grey
 * jacket", which broke CART_ITEMS name-matching in recordLineItems once
 * V2 needed to identify TD-05-A's own line by name. tp-05-005 already
 * located TD-05-A this same way (CatalogPage.productLink('Grey jacket')),
 * confirming Grey Jacket — not "whatever's first" — is TD-05-A's real
 * identity; this just makes the shared helper consistent with that.
 *
 * `includeSecondProduct` adds TD-05-B (Bronze Sandals) before proceeding
 * to checkout — needed wherever a step asserts the order total as the
 * sum of the line totals under SPR-12 (not meaningful against a single
 * line), and in TP-05-006, whose completed order must hold at least two
 * items to satisfy ENV-15 for FN-06's TC-06-018. Per the refined TPS
 * FN-05 (V2), TD-05-B joined TD-05-A in the bound test data for exactly
 * this reason — this parameter defaults to false so tp-05-001/003/004,
 * none of which need it, are unaffected.
 */
export async function addProductAndGoToCheckout(page: Page, includeSecondProduct = false) {
  const header = new HeaderBar(page);
  const catalog = new CatalogPage(page);
  const product = new ProductPage(page);
  const cart = new CartPage(page);
  const checkout = new CheckoutPage(page);

  await header.gotoHome();
  await product.goto(PRODUCT_HANDLES.greyJacket);
  await selectVariantAndAddToCart(page, product);

  if (includeSecondProduct) {
    await addSecondProduct(page);
  }

  await cart.goto();
  await cart.checkoutButton.click();
  await page.waitForLoadState('domcontentloaded');

  return { header, catalog, product, cart, checkout };
}

/**
 * Fills the Delivery section with a valid UK address and waits for the
 * shipping-rate calculation to settle. Confirmed live: the rate appears
 * once Country + City + Postcode are set — full street-level accuracy
 * is not required by this store's rate calculation.
 */
export async function fillDeliveryAddress(
  page: Page,
  checkout: CheckoutPage,
  country: string,
  address = { firstName: 'Test', lastName: 'User', address1: '221B Baker Street', city: 'London', postcode: 'NW1 6XE' },
) {
  await checkout.countrySelect.selectOption({ label: country });
  await checkout.deliveryField('First name (optional)').fill(address.firstName);
  await checkout.deliveryField('Last name').fill(address.lastName);
  await checkout.deliveryField('Address').fill(address.address1);
  await page.waitForTimeout(800);
  await page.keyboard.press('Escape').catch(() => {});
  await checkout.deliveryField('City').fill(address.city);
  await checkout.deliveryField('Postcode').fill(address.postcode);
  await page.getByRole('heading', { name: 'Payment' }).click({ timeout: 3000 }).catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1000);
}

/**
 * Changing the delivery country after a rate is already shown briefly
 * resets the Shipping row back to the "Enter shipping address"
 * placeholder while it recalculates — confirmed live, a fixed short
 * wait sometimes reads that placeholder instead of the new rate. Polls
 * until the cell shows a real currency value instead.
 */
export async function waitForShippingCost(page: Page, checkout: CheckoutPage) {
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await expect(checkout.costSummaryRow('Shipping').first()).toContainText(/£\d/, { timeout: 15000 });
}

/** Fills the three PCI iframe fields plus name on card. Confirmed live locators via CheckoutPage.cardField(). */
export async function fillCard(
  checkout: CheckoutPage,
  cardNumber: string,
  expiry: string,
  cvv: string,
  nameOnCard = 'Test User',
) {
  await checkout.cardField('Card number').fill(cardNumber);
  await checkout.cardField('Expiration date (MM / YY)').fill(expiry);
  await checkout.cardField('Security code').fill(cvv);
  await checkout.cardField('Name on card').fill(nameOnCard);
}

export const TEST_CARDS = {
  approved: '1',
  declined: '2',
  gatewayFailure: '3',
};

/**
 * SPR-16 requires the simulation value used to be recorded on every run,
 * named by the OUTCOME it represents as well as by its bound value, so a
 * change to the store's testing panel affects the Input column alone and
 * never an expected result. Keeping the pairing here means a spec cites
 * the outcome and the value travels with it.
 */
export const SIMULATION_VALUES = {
  approved: { id: 'TD-05-P1', outcome: 'approved payment', value: TEST_CARDS.approved },
  declined: { id: 'TD-05-P2', outcome: 'declined payment', value: TEST_CARDS.declined },
  gatewayFailure: { id: 'TD-05-P3', outcome: 'gateway failure', value: TEST_CARDS.gatewayFailure },
} as const;

/** SPR-16: records which simulation value was used for a submission, by outcome and by value. */
export async function recordSimulationValue(
  testInfo: TestInfo,
  label: string,
  simulation: (typeof SIMULATION_VALUES)[keyof typeof SIMULATION_VALUES],
) {
  await testInfo.attach(`Simulation value used — ${label}`, {
    body: `${simulation.id} — ${simulation.outcome}\nbound value entered as card number: ${simulation.value}`,
    contentType: 'text/plain',
  });
}

/**
 * SPR-23: "record which messages were shown, and which were not. A
 * required field error, a format error, a length error and a credentials
 * error are distinct outcomes and only one is expected on any given
 * attempt."
 *
 * Recording only the refusal is not enough to discharge that — the report
 * has to show which message appeared and, where the procedure names
 * alternatives, which did not. Checkout renders validation text into
 * live regions (role="alert" / aria-live) rather than into stable
 * classes, which are hashed per build (see CheckoutPage), so those roles
 * are the only durable handle.
 *
 * `expected` lists the distinct outcomes this step could produce; each is
 * reported as shown or not shown.
 */
export async function recordMessages(
  page: Page,
  testInfo: TestInfo,
  label: string,
  expected: string[] = [],
) {
  const observed = (
    await page.locator('[role="alert"], [aria-live="polite"], [aria-live="assertive"]').allInnerTexts()
  )
    .map((text) => text.trim())
    .filter(Boolean);
  const unique = [...new Set(observed)];

  const shown = expected.filter((candidate) =>
    unique.some((text) => text.toLowerCase().includes(candidate.toLowerCase())),
  );
  const notShown = expected.filter((candidate) => !shown.includes(candidate));

  await testInfo.attach(`Messages — ${label}`, {
    body:
      `messages shown:\n${unique.length ? unique.map((t) => `  - ${t}`).join('\n') : '  (none displayed)'}\n` +
      (expected.length
        ? `\nchecked for these distinct outcomes:\n` +
          `  shown:     ${shown.length ? shown.join(', ') : '(none)'}\n` +
          `  NOT shown: ${notShown.length ? notShown.join(', ') : '(none)'}`
        : ''),
    contentType: 'text/plain',
  });

  return { observed: unique, shown, notShown };
}

/**
 * SPR-23 also requires the field contents to be recorded after an
 * over-length entry: where a field caps input, the value is truncated on
 * entry and the residue may no longer be valid, so truncation must not be
 * mistaken for the expected refusal.
 */
export async function recordFieldContents(
  testInfo: TestInfo,
  label: string,
  entered: string,
  actual: string,
) {
  await testInfo.attach(`Field contents — ${label}`, {
    body:
      `entered:  ${entered} (${entered.length} characters)\n` +
      `retained: ${actual} (${actual.length} characters)\n` +
      `truncated on entry: ${actual !== entered}`,
    contentType: 'text/plain',
  });
}

/**
 * SPR-12: records each cart line's quantity and price, read from
 * checkout's order-summary "Shopping cart" table (CheckoutPage.
 * lineItemRow), not just the subtotal/total — the refined TPS FN-05
 * asks for "each line total" specifically wherever it asserts the order
 * total as the sum of the line totals, which is only meaningful with a
 * two-line cart. Returns the sum of the line prices, for asserting
 * against the subtotal.
 */
export async function recordLineItems(
  testInfo: TestInfo,
  checkout: CheckoutPage,
  label: string,
  productNames: string[],
): Promise<number> {
  const lines = await Promise.all(
    productNames.map(async (name) => {
      const quantity = (await checkout.lineItemQuantity(name).textContent().catch(() => null))?.trim() ?? '(not found)';
      const price = parseMoney(await checkout.lineItemPrice(name).textContent().catch(() => null));
      return { name, quantity, price };
    }),
  );
  await testInfo.attach(`Line items — ${label}`, {
    body: lines.map((l) => `${l.name}: quantity ${l.quantity}, price £${Number.isFinite(l.price) ? l.price.toFixed(2) : l.price}`).join('\n'),
    contentType: 'text/plain',
  });
  return lines.reduce((sum, l) => sum + (Number.isFinite(l.price) ? l.price : 0), 0);
}
