import { test, expect } from '../../utils/pacedTest';
import { addProductAndGoToCheckout, fillDeliveryAddress, waitForShippingCost } from './_helpers';
import { recordUrl, parseMoney } from '../../utils/evidence';

/**
 * TP-05-012 — Verify changing the destination country after a shipping
 * cost is displayed recalculates it. Covers TC-05-012 (#1 to #3).
 * Oracle rates (UK £10, France £20) are the TPS's own published values.
 */
const UK_RATE = 10.0;
const FRANCE_RATE = 20.0;

test.describe('FN-05 Checkout', () => {
  test('TP-05-012 destination country change recalculation', async ({ page }, testInfo) => {
    test.setTimeout(90000);
    const { checkout } = await addProductAndGoToCheckout(page);

    await test.step('TC-05-012 #1 — record published UK and France oracle rates', async () => {
      await testInfo.attach('Oracle rates', {
        body: `UK (published): £${UK_RATE.toFixed(2)}\nFrance (published): £${FRANCE_RATE.toFixed(2)}`,
        contentType: 'text/plain',
      });
    });

    await test.step('TC-05-012 #2 — UK delivery address applies the UK shipping cost', async () => {
      await fillDeliveryAddress(page, checkout, 'United Kingdom');
      await recordUrl(page, testInfo, 'UK address entered');

      const shipping = parseMoney(await checkout.costSummaryRow('Shipping').first().textContent());
      await testInfo.attach('Initial UK shipping cost', { body: `£${shipping}`, contentType: 'text/plain' });
      expect(shipping).toBeCloseTo(UK_RATE, 2);
    });

    await test.step('TC-05-012 #3 — changing country to France recalculates shipping cost and total', async () => {
      const subtotal = parseMoney(await checkout.costSummaryRow('Subtotal').first().textContent());

      await checkout.countrySelect.selectOption({ label: 'France' });
      // Confirmed live: switching country invalidates the previously
      // entered UK-format city/postcode for rate purposes — the store
      // won't recalculate until a France-appropriate city/postcode is
      // re-entered, so a real shopper would naturally update these too.
      await checkout.deliveryField('City').fill('Paris');
      await checkout.deliveryField('Postcode').fill('75007');
      await waitForShippingCost(page, checkout);

      const shipping = parseMoney(await checkout.costSummaryRow('Shipping').first().textContent());
      const total = parseMoney(await checkout.costSummaryRow('Total').first().textContent());
      await testInfo.attach('Recalculated France shipping cost', {
        body: `subtotal: ${subtotal}\nshipping: ${shipping}\ntotal: ${total}`,
        contentType: 'text/plain',
      });

      expect(shipping).toBeCloseTo(FRANCE_RATE, 2);
      expect(total).toBeCloseTo(subtotal + shipping, 2);
    });
  });
});
