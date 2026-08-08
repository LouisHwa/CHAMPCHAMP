import { Browser, Page, TestInfo, expect } from '@playwright/test';
import { HeaderBar } from '../../pages/HeaderBar';
import { CatalogPage } from '../../pages/CatalogPage';
import { ProductPage } from '../../pages/ProductPage';
import { CartPage } from '../../pages/CartPage';
import { CheckoutPage } from '../../pages/CheckoutPage';

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
 * Shared FN-05 setup: empty-cart baseline (ENV-08) through to a fresh
 * checkout page with one product line. Every guest-checkout TP needs
 * this same path, confirmed live: Home -> Catalog -> first in-stock
 * product -> select first available size/colour if present -> Add to
 * Cart -> /cart -> #checkout -> the single-page Shopify checkout.
 */
export async function addProductAndGoToCheckout(page: Page) {
  const header = new HeaderBar(page);
  const catalog = new CatalogPage(page);
  const product = new ProductPage(page);
  const cart = new CartPage(page);
  const checkout = new CheckoutPage(page);

  await header.gotoHome();
  await catalog.goto();
  await catalog.grid.locator('a').first().click();
  await page.waitForLoadState('domcontentloaded');

  if (await product.sizeSelect.count() > 0 && (await product.sizeSelect.locator('option').count()) > 1) {
    const value = await product.sizeSelect.locator('option').nth(1).getAttribute('value');
    if (value) await product.selectSize(value);
  }
  if (await product.colourSelect.count() > 0 && (await product.colourSelect.locator('option').count()) > 1) {
    const value = await product.colourSelect.locator('option').nth(1).getAttribute('value');
    if (value) await product.selectColour(value);
  }

  // Wait for the actual /cart/add response, not just networkidle — with
  // slowMo pacing now in the mix, networkidle alone was confirmed live
  // to sometimes resolve before the add-to-cart AJAX call completes,
  // leaving the cart genuinely empty at the next step. Start waiting
  // before the click so there's no race between them.
  const cartAddResponse = page.waitForResponse((r) => r.url().includes('/cart/add'), { timeout: 10_000 }).catch(() => null);
  await product.addToCartButton.click();
  await cartAddResponse;
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
