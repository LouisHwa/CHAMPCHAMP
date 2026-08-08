import { test, expect } from '../../utils/pacedTest';
import { addProductAndGoToCheckout, fillDeliveryAddress } from './_helpers';
import { recordUrl } from '../../utils/evidence';

/**
 * TP-05-004 — Verify the card number field accepts a 16-digit number
 * satisfying the Luhn check digit and rejects one that fails it, at
 * constant length. Covers TC-05-004 (#1 to #3).
 *
 * Same field-level readback approach as TP-05-003, and the same caveat:
 * a prior live capture found NO client-side Luhn check on this field at
 * all (any digit string is accepted), which would contradict the TPS
 * here too. No FN-05 Defect Log entry exists yet, so the TPS's
 * documented outcome is still hard-asserted below.
 */
function fieldReadback(field: import('@playwright/test').Locator, candidate: string) {
  return field.fill('').then(() => field.fill(candidate)).then(() =>
    field.evaluate((el) => {
      const input = el as HTMLInputElement;
      return { value: input.value, valid: input.validity.valid };
    }),
  );
}

test.describe('FN-05 Checkout', () => {
  test('TP-05-004 card number Luhn check digit', async ({ page }, testInfo) => {
    test.setTimeout(90000);
    const { checkout } = await addProductAndGoToCheckout(page);
    await fillDeliveryAddress(page, checkout, 'United Kingdom');
    await recordUrl(page, testInfo, 'Payment section reached');

    const cardField = checkout.cardField('Card number');

    await test.step('TC-05-004 #2 — 16-digit Luhn-valid card number is accepted', async () => {
      const candidate = '4000000000000002';
      const { value, valid } = await fieldReadback(cardField, candidate);
      await testInfo.attach('Luhn-valid readback', {
        body: `entered: ${candidate}\nreadback: ${value}\nvalid: ${valid}`,
        contentType: 'text/plain',
      });
      expect(value.replace(/\D/g, '')).toBe(candidate);
      expect(valid).toBe(true);
    });

    await test.step('TC-05-004 #3 — 16-digit Luhn-invalid card number is not accepted', async () => {
      const candidate = '4000000000000003';
      const { value, valid } = await fieldReadback(cardField, candidate);
      await testInfo.attach('Luhn-invalid readback', {
        body: `entered: ${candidate}\nreadback: ${value}\nvalid: ${valid}`,
        contentType: 'text/plain',
      });
      const fullyRetained = value.replace(/\D/g, '') === candidate;
      expect(fullyRetained && valid).toBe(false);
    });
  });
});
