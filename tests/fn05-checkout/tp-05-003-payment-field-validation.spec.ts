import { test, expect } from '../../utils/pacedTest';
import type { Locator } from '@playwright/test';
import { addProductAndGoToCheckout, fillDeliveryAddress } from './_helpers';
import { recordUrl } from '../../utils/evidence';

/**
 * TP-05-003 — Verify the card number field accepts lengths within 13 to
 * 19 digits and rejects lengths outside that range and non-numeric
 * input, that it accepts a number satisfying the Luhn check digit and
 * rejects one that fails it at constant length, that the security code
 * field accepts 3- and 4-digit values and rejects values outside that
 * range, and that the expiry date field accepts a future date and
 * rejects expired or non-calendar dates. Covers TC-05-003, TC-05-004,
 * TC-05-005, TC-05-006 (merged per the refined TPS FN-05, replacing the
 * old separate TP-05-003/004/005/006) — the Payment section is opened
 * once and every field is exercised in place.
 *
 * "Accepts"/"does not accept" is read at the field level: after typing
 * a candidate, the field's live DOM value (readback) and native
 * validity.valid state are captured inside the cross-origin PCI iframe
 * via Playwright's frame-aware evaluate (not a same-origin script, so
 * this is not something the page itself could read — it's evidence).
 * This avoids submitting a real test order for every boundary
 * candidate — no order is completed by this procedure (SPR-18 doesn't
 * apply), matching the refined document's own note.
 *
 * IMPORTANT: a prior live capture found the card number field imposes
 * NO length limit and NO Luhn check at all — every length from 11 to
 * 22 digits was retained in full with validity.valid = true. This is
 * not yet in the team's Defect Log, so the assertions below still
 * hard-assert the TPS's documented ranges rather than being softened —
 * if they fail, that failure is the evidence the log needs.
 */
async function fieldReadback(field: Locator, candidate: string) {
  await field.fill('');
  await field.fill(candidate);
  return field.evaluate((el) => {
    const input = el as HTMLInputElement;
    return { value: input.value, valid: input.validity.valid };
  });
}

function monthYear(offsetMonths: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + offsetMonths);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = String(d.getFullYear() % 100).padStart(2, '0');
  return `${mm}/${yy}`;
}

test.describe('FN-05 Checkout', () => {
  test('TP-05-003 payment field validation', async ({ page }, testInfo) => {
    test.setTimeout(150_000);

    const { checkout } = await addProductAndGoToCheckout(page);
    await fillDeliveryAddress(page, checkout, 'United Kingdom');
    await recordUrl(page, testInfo, 'Payment section reached');

    await test.step('TC-05-003 #1 — Payment section displays card number, expiry, CVV, name fields', async () => {
      await expect(checkout.cardField('Card number')).toBeVisible();
      await expect(checkout.cardField('Expiration date (MM / YY)')).toBeVisible();
      await expect(checkout.cardField('Security code')).toBeVisible();
      await expect(checkout.cardField('Name on card')).toBeVisible();
    });

    const cardField = checkout.cardField('Card number');
    const cardLengthCases: Array<{ label: string; candidate: string; shouldAccept: boolean }> = [
      { label: 'TC-05-003 #2 — 12-digit (below min)', candidate: '400000000002', shouldAccept: false },
      { label: 'TC-05-003 #3 — 13-digit (at min)', candidate: '4000000000006', shouldAccept: true },
      { label: 'TC-05-003 #4 — 16-digit (within range)', candidate: '4111111111111111', shouldAccept: true },
      { label: 'TC-05-003 #5 — 19-digit (at max)', candidate: '4000000000000000006', shouldAccept: true },
      { label: 'TC-05-003 #6 — 20-digit (above max)', candidate: '40000000000000000002', shouldAccept: false },
      { label: 'TC-05-003 #7 — 11-digit (well below range)', candidate: '40000000006', shouldAccept: false },
      { label: 'TC-05-003 #8 — 22-digit (well above range)', candidate: '4000000000000000000002', shouldAccept: false },
    ];

    for (const c of cardLengthCases) {
      await test.step(c.label, async () => {
        const { value, valid } = await fieldReadback(cardField, c.candidate);
        const retainedDigits = value.replace(/\D/g, '');
        const fullyRetained = retainedDigits === c.candidate;
        await testInfo.attach(`${c.label} — readback`, {
          body: `entered: ${c.candidate}\nreadback: ${value}\nretained digits: ${retainedDigits}\nvalid: ${valid}\nexpected accept: ${c.shouldAccept}`,
          contentType: 'text/plain',
        });
        expect(fullyRetained && valid).toBe(c.shouldAccept);
      });
    }

    await test.step('TC-05-003 #9 — non-numeric characters are not accepted', async () => {
      const candidate = '4111-11XY-1111';
      const { value } = await fieldReadback(cardField, candidate);
      await testInfo.attach('TC-05-003 #9 — readback', {
        body: `entered: ${candidate}\nreadback: ${value}`,
        contentType: 'text/plain',
      });
      // The field filters non-digit keystrokes as they're typed, so
      // letters/dashes never make it into the value — confirming they
      // are not accepted, even though no explicit error is shown.
      expect(value).not.toMatch(/[A-Za-z]/);
    });

    await test.step('Set Up — clear card number field before TC-05-004', async () => {
      await cardField.fill('');
      await expect(cardField).toBeVisible();
    });

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

    const cvvField = checkout.cardField('Security code');

    await test.step('TC-05-005 #1 — enter valid card + expiry, Payment section displays security code field', async () => {
      await cardField.fill('4111111111111111');
      await checkout.cardField('Expiration date (MM / YY)').fill('12/29');
      await expect(cvvField).toBeVisible();
    });

    function cvvReadback(field: Locator, candidate: string) {
      return field.fill('').then(() => field.fill(candidate)).then(() => field.evaluate((el) => (el as HTMLInputElement).value));
    }

    const cvvCases: Array<{ label: string; candidate: string; shouldAccept: boolean }> = [
      { label: 'TC-05-005 #2 — 0-digit (empty)', candidate: '', shouldAccept: false },
      { label: 'TC-05-005 #3 — 2-digit (below min)', candidate: '12', shouldAccept: false },
      { label: 'TC-05-005 #4 — 3-digit (at min)', candidate: '123', shouldAccept: true },
      { label: 'TC-05-005 #6 — 5-digit (above max)', candidate: '12345', shouldAccept: false },
      { label: 'TC-05-005 #7 — 7-digit (well above max)', candidate: '1234567', shouldAccept: false },
    ];

    for (const c of cvvCases) {
      await test.step(c.label, async () => {
        const value = await cvvReadback(cvvField, c.candidate);
        await testInfo.attach(`${c.label} — readback`, {
          body: `entered: "${c.candidate}"\nreadback: "${value}"`,
          contentType: 'text/plain',
        });
        const accepted = value.length >= 3 && value.length <= 4;
        expect(accepted).toBe(c.shouldAccept);
      });
    }

    await test.step('TC-05-005 #5 — Amex card accepts a 4-digit security code', async () => {
      await cardField.fill('');
      await cardField.fill('370000000000002');
      const value = await cvvReadback(cvvField, '1234');
      await testInfo.attach('Amex 4-digit CVV readback', {
        body: `readback: "${value}"`,
        contentType: 'text/plain',
      });
      expect(value.length).toBe(4);
    });

    const expiryField = checkout.cardField('Expiration date (MM / YY)');

    await test.step('TC-05-006 #1 — valid card number, Payment section displays expiry date field', async () => {
      await cardField.fill('');
      await cardField.fill('4111111111111111');
      await expect(expiryField).toBeVisible();
    });

    const currentBoundary = monthYear(0);
    const oneMonthBefore = monthYear(-1);

    await test.step('TC-05-006 #2 — record current calendar month and year as the execution boundary', async () => {
      await testInfo.attach('TC-05-006 #2 — execution date boundary', {
        body: `current month/year: ${currentBoundary}`,
        contentType: 'text/plain',
      });
    });

    function expiryReadback(field: Locator, candidate: string) {
      return field.fill('').then(() => field.fill(candidate)).then(() =>
        field.evaluate((el) => {
          const input = el as HTMLInputElement;
          return { value: input.value, valid: input.validity.valid };
        }),
      );
    }

    const expiryCases: Array<{ label: string; candidate: string; shouldAccept: boolean }> = [
      { label: 'TC-05-006 #3 — 1 month before current (expired)', candidate: oneMonthBefore, shouldAccept: false },
      { label: 'TC-05-006 #4 — current month/year (earliest not expired)', candidate: currentBoundary, shouldAccept: true },
      { label: 'TC-05-006 #5 — future date 12/29', candidate: '12/29', shouldAccept: true },
      { label: 'TC-05-006 #6 — past date 01/20', candidate: '01/20', shouldAccept: false },
      { label: 'TC-05-006 #7 — non-calendar month 13/27', candidate: '13/27', shouldAccept: false },
    ];

    for (const c of expiryCases) {
      await test.step(c.label, async () => {
        const { value, valid } = await expiryReadback(expiryField, c.candidate);
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
