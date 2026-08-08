import { test, expect } from '../../utils/pacedTest';
import { addProductAndGoToCheckout, fillDeliveryAddress } from './_helpers';
import { recordUrl, parseMoney } from '../../utils/evidence';

/**
 * TP-05-011 — Verify a non-UK destination (France) applies the
 * published international shipping cost. Covers TC-05-011 (#1, #2).
 * Oracle rate (£20, published per TP-05-012) is hardcoded, per SPR-17.
 */
const FRANCE_RATE = 20.0;

test.describe('FN-05 Checkout', () => {
  test('TP-05-011 international shipping cost', async ({ page }, testInfo) => {
    test.setTimeout(60000);
    const { checkout } = await addProductAndGoToCheckout(page);

    await test.step('TC-05-011 #1 — record published France shipping rate as oracle', async () => {
      await testInfo.attach('Oracle rate', {
        body: `France (published): £${FRANCE_RATE.toFixed(2)}`,
        contentType: 'text/plain',
      });
    });

    await test.step('TC-05-011 #2 — France delivery address applies the published France rate', async () => {
      await fillDeliveryAddress(page, checkout, 'France', {
        firstName: 'Test',
        lastName: 'User',
        address1: '5 Avenue Anatole France',
        city: 'Paris',
        postcode: '75007',
      });
      await recordUrl(page, testInfo, 'France address entered');

      const subtotal = parseMoney(await checkout.costSummaryRow('Subtotal').first().textContent());
      const shipping = parseMoney(await checkout.costSummaryRow('Shipping').first().textContent());
      const total = parseMoney(await checkout.costSummaryRow('Total').first().textContent());
      await testInfo.attach('France cost summary', {
        body: `subtotal: ${subtotal}\nshipping: ${shipping}\ntotal: ${total}`,
        contentType: 'text/plain',
      });

      expect(shipping).toBeCloseTo(FRANCE_RATE, 2);
      expect(total).toBeCloseTo(subtotal + shipping, 2);
    });
  });
});
