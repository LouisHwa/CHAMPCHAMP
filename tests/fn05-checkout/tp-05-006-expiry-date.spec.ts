import { test, expect } from '../../utils/pacedTest';
import { addProductAndGoToCheckout, fillDeliveryAddress } from './_helpers';
import { recordUrl } from '../../utils/evidence';

/**
 * TP-05-006 — Verify the expiry date field accepts a future date and
 * rejects expired or non-calendar dates. Covers TC-05-006 (#1 to #7).
 *
 * The current-month/year boundary (TC-05-006 #2) is computed at
 * execution time from the real clock rather than hardcoded, so the test
 * stays correct regardless of when it's run.
 */
function monthYear(offsetMonths: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + offsetMonths);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = String(d.getFullYear() % 100).padStart(2, '0');
  return `${mm}/${yy}`;
}

function fieldReadback(field: import('@playwright/test').Locator, candidate: string) {
  return field.fill('').then(() => field.fill(candidate)).then(() =>
    field.evaluate((el) => {
      const input = el as HTMLInputElement;
      return { value: input.value, valid: input.validity.valid };
    }),
  );
}

test.describe('FN-05 Checkout', () => {
  test('TP-05-006 expiry date validation', async ({ page }, testInfo) => {
    test.setTimeout(90000);
    const { checkout } = await addProductAndGoToCheckout(page);
    await fillDeliveryAddress(page, checkout, 'United Kingdom');
    await recordUrl(page, testInfo, 'Payment section reached');
    await checkout.cardField('Card number').fill('4111111111111111');

    const expiryField = checkout.cardField('Expiration date (MM / YY)');
    const currentBoundary = monthYear(0);
    const oneMonthBefore = monthYear(-1);
    await testInfo.attach('TC-05-006 #2 — execution date boundary', {
      body: `current month/year: ${currentBoundary}`,
      contentType: 'text/plain',
    });

    const cases: Array<{ label: string; candidate: string; shouldAccept: boolean }> = [
      { label: 'TC-05-006 #3 — 1 month before current (expired)', candidate: oneMonthBefore, shouldAccept: false },
      { label: 'TC-05-006 #4 — current month/year (earliest not expired)', candidate: currentBoundary, shouldAccept: true },
      { label: 'TC-05-006 #5 — future date 12/29', candidate: '12/29', shouldAccept: true },
      { label: 'TC-05-006 #6 — past date 01/20', candidate: '01/20', shouldAccept: false },
      { label: 'TC-05-006 #7 — non-calendar month 13/27', candidate: '13/27', shouldAccept: false },
    ];

    for (const c of cases) {
      await test.step(c.label, async () => {
        const { value, valid } = await fieldReadback(expiryField, c.candidate);
        const fullyRetained = value.replace(/\s/g, '') === c.candidate;
        await testInfo.attach(`${c.label} — readback`, {
          body: `entered: ${c.candidate}\nreadback: ${value}\nvalid: ${valid}\nexpected accept: ${c.shouldAccept}`,
          contentType: 'text/plain',
        });
        expect(fullyRetained && valid).toBe(c.shouldAccept);
      });
    }
  });
});
