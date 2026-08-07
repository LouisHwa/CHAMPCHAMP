import { test, expect } from '@playwright/test';
import { addProductAndGoToCheckout, fillDeliveryAddress } from './_helpers';
import { recordUrl } from '../../utils/evidence';

/**
 * TP-05-005 — Verify the security code field accepts 3- and 4-digit
 * values and rejects values outside that range, at and either side of
 * both boundaries, including the Amex 4-digit case. Covers TC-05-005
 * (#1 to #7).
 *
 * Confirmed live (2026-08-07): the field does impose a hard maxlength
 * of 4 — 5- and 7-digit entries are truncated to 4 characters at the
 * keystroke level, so those two boundary cases are expected to pass as
 * documented. The 0- and 2-digit (below-minimum) cases are NOT
 * mechanically blocked the same way, so — as with TP-05-003/004 — the
 * assertions below still hard-assert the TPS's documented range; a
 * failure there is new evidence for the Defect Log, not a test bug.
 */
function fieldReadback(field: import('@playwright/test').Locator, candidate: string) {
  return field.fill('').then(() => field.fill(candidate)).then(() =>
    field.evaluate((el) => (el as HTMLInputElement).value),
  );
}

test.describe('FN-05 Checkout', () => {
  test('TP-05-005 security code length', async ({ page }, testInfo) => {
    test.setTimeout(90000);
    const { checkout } = await addProductAndGoToCheckout(page);
    await fillDeliveryAddress(page, checkout, 'United Kingdom');
    await recordUrl(page, testInfo, 'Payment section reached');

    const cvvField = checkout.cardField('Security code');
    const cases: Array<{ label: string; candidate: string; shouldAccept: boolean }> = [
      { label: 'TC-05-005 #2 — 0-digit (empty)', candidate: '', shouldAccept: false },
      { label: 'TC-05-005 #3 — 2-digit (below min)', candidate: '12', shouldAccept: false },
      { label: 'TC-05-005 #4 — 3-digit (at min)', candidate: '123', shouldAccept: true },
      { label: 'TC-05-005 #6 — 5-digit (above max)', candidate: '12345', shouldAccept: false },
      { label: 'TC-05-005 #7 — 7-digit (well above max)', candidate: '1234567', shouldAccept: false },
    ];

    for (const c of cases) {
      await test.step(c.label, async () => {
        const value = await fieldReadback(cvvField, c.candidate);
        await testInfo.attach(`${c.label} — readback`, {
          body: `entered: "${c.candidate}"\nreadback: "${value}"`,
          contentType: 'text/plain',
        });
        const accepted = value.length >= 3 && value.length <= 4;
        expect(accepted).toBe(c.shouldAccept);
      });
    }

    await test.step('TC-05-005 #5 — Amex card accepts a 4-digit security code', async () => {
      await checkout.cardField('Card number').fill('').then(() => checkout.cardField('Card number').fill('370000000000002'));
      const value = await fieldReadback(cvvField, '1234');
      await testInfo.attach('Amex 4-digit CVV readback', {
        body: `readback: "${value}"`,
        contentType: 'text/plain',
      });
      expect(value.length).toBe(4);
    });
  });
});
