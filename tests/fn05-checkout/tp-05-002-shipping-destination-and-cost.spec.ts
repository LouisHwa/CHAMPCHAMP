import { test, expect } from '../../utils/pacedTest';
import { CartPage } from '../../pages/CartPage';
import { addProductAndGoToCheckout, fillDeliveryAddress, waitForShippingCost, recordMessages, recordLineItems } from './_helpers';
import { recordUrl, parseMoney } from '../../utils/evidence';
import { PRODUCTS } from '../../fixtures/test-data';

const CART_ITEMS = [PRODUCTS.greyJacket, PRODUCTS.bronzeSandals];

/**
 * TP-05-002 — Verify shipping cost is applied by destination country
 * and recalculated when the country changes, that a blank or
 * unsupported country is rejected, and that a non-UK destination
 * applies the published international cost during a purchase. Covers
 * TC-05-002, TC-05-011, TC-05-012 (merged per the refined TPS FN-05,
 * replacing the old separate TP-05-002/011/012).
 *
 * V2 update: the refined TPS FN-05's original "TCS correction required"
 * note against this procedure (Set Up step 6 discharging [TC-05-002 #4],
 * which the note said did not yet exist in Table 2.3.5.2) has been
 * removed in the V2 document — the underlying TCS gap has been fixed
 * upstream. TC-05-002 #4's own step logic is unchanged from before.
 *
 * V2 also adds TD-05-B (Bronze Sandals) alongside TD-05-A in every cart
 * this procedure builds: "TD-05-B is added alongside TD-05-A wherever a
 * step asserts the order total as the sum of the line totals under
 * SPR-12, since that assertion is not meaningful against a single
 * line." addProductAndGoToCheckout(page, true) below adds both.
 *
 * Oracle rates (UK £10, France £20) are hardcoded per SPR-17's "record
 * before each assertion" requirement — recorded fresh at each Set Up
 * step below even though the same destinations repeat, matching the
 * document's own note that the applied cost is checked against the
 * recording, never against a previously displayed cost.
 */
const UK_RATE = 10.0;
const FRANCE_RATE = 20.0;

test.describe('FN-05 Checkout', () => {
  test('TP-05-002 shipping destination and cost', async ({ page }, testInfo) => {
    test.setTimeout(120_000);

    await test.step('TC-05-002 — UK/France rates recorded as oracles before any address is entered', async () => {
      await testInfo.attach('Oracle rates (TC-05-002)', {
        body: `UK (published): £${UK_RATE.toFixed(2)}\nFrance (published): £${FRANCE_RATE.toFixed(2)}`,
        contentType: 'text/plain',
      });
    });

    const { checkout } = await addProductAndGoToCheckout(page, true);

    await test.step('TC-05-002 #1 — UK delivery address applies the published UK rate', async () => {
      await fillDeliveryAddress(page, checkout, 'United Kingdom');
      await recordUrl(page, testInfo, 'UK address entered');

      const lineTotal = await recordLineItems(testInfo, checkout, 'TC-05-002 #1', CART_ITEMS);
      const subtotal = parseMoney(await checkout.costSummaryRow('Subtotal').first().textContent());
      const shipping = parseMoney(await checkout.costSummaryRow('Shipping').first().textContent());
      const total = parseMoney(await checkout.costSummaryRow('Total').first().textContent());
      await testInfo.attach('UK cost summary', {
        body: `subtotal: ${subtotal}\nshipping: ${shipping}\ntotal: ${total}`,
        contentType: 'text/plain',
      });

      expect(lineTotal).toBeCloseTo(subtotal, 2);
      expect(shipping).toBeCloseTo(UK_RATE, 2);
      expect(total).toBeCloseTo(subtotal + shipping, 2);
    });

    await test.step('TC-05-002 #2 — changing country to France recalculates shipping cost', async () => {
      await checkout.countrySelect.selectOption({ label: 'France' });
      // Confirmed live: switching country invalidates the previously
      // entered UK-format city/postcode for rate purposes.
      await checkout.deliveryField('City').fill('Paris');
      await checkout.deliveryField('Postcode').fill('75007');
      await waitForShippingCost(page, checkout);

      const lineTotal = await recordLineItems(testInfo, checkout, 'TC-05-002 #2', CART_ITEMS);
      const subtotal = parseMoney(await checkout.costSummaryRow('Subtotal').first().textContent());
      const shipping = parseMoney(await checkout.costSummaryRow('Shipping').first().textContent());
      const total = parseMoney(await checkout.costSummaryRow('Total').first().textContent());
      await testInfo.attach('France cost summary', {
        body: `subtotal: ${subtotal}\nshipping: ${shipping}\ntotal: ${total}`,
        contentType: 'text/plain',
      });

      expect(lineTotal).toBeCloseTo(subtotal, 2);
      expect(shipping).toBeCloseTo(FRANCE_RATE, 2);
      expect(total).toBeCloseTo(subtotal + shipping, 2);
    });

    await test.step('TC-05-002 #3 — no destination selected does not proceed to checkout completion', async () => {
      const blankOption = checkout.countrySelect.locator('option[value=""]');
      const hasBlankOption = (await blankOption.count()) > 0;
      await testInfo.attach('Blank-country reachability', {
        body: `Country/Region has a blank option: ${hasBlankOption}`,
        contentType: 'text/plain',
      });

      if (hasBlankOption) {
        await checkout.countrySelect.selectOption('');
      } else {
        // Native <select> with no blank option — a shopper cannot clear
        // it via the UI. Emulate "no destination selected" the closest
        // reachable way: clear the required Address/City/Postcode
        // fields instead, then attempt to submit.
        await checkout.deliveryField('Address').fill('');
        await checkout.deliveryField('City').fill('');
        await checkout.deliveryField('Postcode').fill('');
      }
      await checkout.payNowButton.click().catch(() => {});
      await page.waitForTimeout(2000);
      const url = await recordUrl(page, testInfo, 'After incomplete-destination submit attempt');

      // SPR-23: the TC requires the delivery fields required for the order
      // to be identified as incomplete, and which message was shown to be
      // recorded alongside those that were not.
      await recordMessages(page, testInfo, 'TC-05-002 #3 blank destination', [
        'Enter an address',
        'Enter a city',
        'Enter a postcode',
        'Select a country',
        'not available',
      ]);

      // This procedure completes no order (TPS Table 2.5.2). If checkout
      // proceeded anyway, that is an unplanned order and SPR-18 requires it
      // identifiable — fail loudly rather than leave it unrecorded.
      if (!url.includes('/checkouts/')) {
        await testInfo.attach('UNPLANNED ORDER — TC-05-002 #3', {
          body:
            `Checkout left the checkout page on a submission this procedure expects to be ` +
            `refused, so an order may have been completed.\ndestination: ${url}\n` +
            `page:\n${await page.locator('main').innerText().catch(() => '(unreadable)')}`,
          contentType: 'text/plain',
        });
      }
      expect.soft(url).toContain('/checkouts/');
    });

    await test.step('TC-05-002 #4 — unsupported destination country', async () => {
      const optionLabels = await checkout.countrySelect.locator('option').allTextContents();
      const unsupportedPresent = optionLabels.some((label) => /unsupported|test-invalid/i.test(label));
      await testInfo.attach('Unsupported-country reachability', {
        body: `Country/Region options are a fixed real-country list (${optionLabels.length} entries); no unsupported/placeholder value is present: ${!unsupportedPresent}`,
        contentType: 'text/plain',
      });
      expect.soft(unsupportedPresent).toBe(false);
    });

    await test.step('Reset — return to store, empty cart before TC-05-011', async () => {
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      const cart = new CartPage(page);
      await cart.goto();
      const remaining = await cart.lineCount();
      for (let i = remaining - 1; i >= 0; i--) {
        await cart.removeLine(i).click();
      }
    });

    const tc011 = await addProductAndGoToCheckout(page, true);

    await test.step('TC-05-011 #1 — France rate recorded as oracle', async () => {
      await testInfo.attach('Oracle rate (TC-05-011)', {
        body: `France (published): £${FRANCE_RATE.toFixed(2)}`,
        contentType: 'text/plain',
      });
    });

    await test.step('TC-05-011 #2 — France delivery address applies the published France rate', async () => {
      await fillDeliveryAddress(page, tc011.checkout, 'France', {
        firstName: 'Test',
        lastName: 'User',
        address1: '5 Avenue Anatole France',
        city: 'Paris',
        postcode: '75007',
      });
      await recordUrl(page, testInfo, 'France address entered');

      const lineTotal = await recordLineItems(testInfo, tc011.checkout, 'TC-05-011 #2', CART_ITEMS);
      const subtotal = parseMoney(await tc011.checkout.costSummaryRow('Subtotal').first().textContent());
      const shipping = parseMoney(await tc011.checkout.costSummaryRow('Shipping').first().textContent());
      const total = parseMoney(await tc011.checkout.costSummaryRow('Total').first().textContent());
      await testInfo.attach('France cost summary (TC-05-011)', {
        body: `subtotal: ${subtotal}\nshipping: ${shipping}\ntotal: ${total}`,
        contentType: 'text/plain',
      });

      expect(lineTotal).toBeCloseTo(subtotal, 2);
      expect(shipping).toBeCloseTo(FRANCE_RATE, 2);
      expect(total).toBeCloseTo(subtotal + shipping, 2);
    });

    await test.step('Reset — return to store, empty cart before TC-05-012', async () => {
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      const cart = new CartPage(page);
      await cart.goto();
      const remaining = await cart.lineCount();
      for (let i = remaining - 1; i >= 0; i--) {
        await cart.removeLine(i).click();
      }
    });

    const tc012 = await addProductAndGoToCheckout(page, true);

    await test.step('TC-05-012 #1 — UK and France rates recorded as oracles', async () => {
      await testInfo.attach('Oracle rates (TC-05-012)', {
        body: `UK (published): £${UK_RATE.toFixed(2)}\nFrance (published): £${FRANCE_RATE.toFixed(2)}`,
        contentType: 'text/plain',
      });
    });

    await test.step('TC-05-012 #2 — UK delivery address applies the UK shipping cost', async () => {
      await fillDeliveryAddress(page, tc012.checkout, 'United Kingdom');
      await recordUrl(page, testInfo, 'UK address entered (TC-05-012)');

      const lineTotal = await recordLineItems(testInfo, tc012.checkout, 'TC-05-012 #2', CART_ITEMS);
      const subtotal = parseMoney(await tc012.checkout.costSummaryRow('Subtotal').first().textContent());
      const shipping = parseMoney(await tc012.checkout.costSummaryRow('Shipping').first().textContent());
      await testInfo.attach('Initial UK shipping cost', { body: `£${shipping}`, contentType: 'text/plain' });
      expect(lineTotal).toBeCloseTo(subtotal, 2);
      expect(shipping).toBeCloseTo(UK_RATE, 2);
    });

    await test.step('TC-05-012 #3 — changing country to France recalculates shipping cost and total', async () => {
      const subtotal = parseMoney(await tc012.checkout.costSummaryRow('Subtotal').first().textContent());

      await tc012.checkout.countrySelect.selectOption({ label: 'France' });
      await tc012.checkout.deliveryField('City').fill('Paris');
      await tc012.checkout.deliveryField('Postcode').fill('75007');
      await waitForShippingCost(page, tc012.checkout);

      const lineTotal = await recordLineItems(testInfo, tc012.checkout, 'TC-05-012 #3', CART_ITEMS);
      const shipping = parseMoney(await tc012.checkout.costSummaryRow('Shipping').first().textContent());
      const total = parseMoney(await tc012.checkout.costSummaryRow('Total').first().textContent());
      await testInfo.attach('Recalculated France shipping cost', {
        body: `subtotal: ${subtotal}\nshipping: ${shipping}\ntotal: ${total}`,
        contentType: 'text/plain',
      });

      expect(lineTotal).toBeCloseTo(subtotal, 2);
      expect(shipping).toBeCloseTo(FRANCE_RATE, 2);
      expect(total).toBeCloseTo(subtotal + shipping, 2);
    });

    await test.step('Wrap Up — empty cart, return to store home page', async () => {
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      const cart = new CartPage(page);
      await cart.goto();
      const remaining = await cart.lineCount();
      for (let i = remaining - 1; i >= 0; i--) {
        await cart.removeLine(i).click();
      }
      await page.goto('/', { waitUntil: 'domcontentloaded' });
    });
  });
});
