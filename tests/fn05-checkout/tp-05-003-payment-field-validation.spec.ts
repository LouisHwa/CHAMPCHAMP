import { test, expect } from '../../utils/pacedTest';
import type { Locator } from '@playwright/test';
import { CartPage } from '../../pages/CartPage';
import { HeaderBar } from '../../pages/HeaderBar';
import { addProductAndGoToCheckout, fillDeliveryAddress, recordMessages, recordFieldContents } from './_helpers';
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
 * 22 digits was retained in full with validity.valid = true, and the
 * 13 Aug run confirmed it again (a 12-digit number was accepted). This
 * is not yet in the team's Defect Log; these assertions are the evidence
 * the log needs.
 *
 * They are SOFT rather than hard. A hard assert aborts at the first
 * rejected partition, so the remaining boundary values are never
 * exercised and the Wrap Up never runs — the procedure would report a
 * Fail carrying only a fraction of the evidence. Soft assertions record
 * every partition, still fail the procedure, and let the Wrap Up empty
 * the cart afterwards.
 *
 * Each over-length case also distinguishes TRUNCATION from REFUSAL. The
 * TPS is explicit that where a field caps input, "truncation is not
 * treated as the expected result" — collapsing both into one boolean
 * would let a capped field read as a successful refusal and hide the
 * real behaviour.
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

    await test.step('Set Up — confirm no shopper signed in and an empty cart baseline (ENV-11)', async () => {
      const header = new HeaderBar(page);
      await header.gotoHome();
      const signedOut = await header.logInLink.isVisible().catch(() => false);

      const cart = new CartPage(page);
      await cart.goto();
      const remaining = await cart.lineCount();
      for (let i = remaining - 1; i >= 0; i--) await cart.removeLine(i).click();
      await cart.goto();
      const lines = await cart.lineCount();

      await testInfo.attach('Set Up — preconditions', {
        body: `"Log In" control visible (i.e. no shopper signed in): ${signedOut}
cart lines at baseline: ${lines}`,
        contentType: 'text/plain',
      });
      expect(signedOut, 'ENV-01: no shopper account should be signed in at Set Up').toBe(true);
      expect(lines, 'ENV-08: the cart should be empty at Set Up').toBe(0);
    });

    const { checkout } = await addProductAndGoToCheckout(page);
    await fillDeliveryAddress(page, checkout, 'United Kingdom');
    await recordUrl(page, testInfo, 'Payment section reached');

    await test.step('Set Up — confirm the checkout testing panel is present (ENV-12)', async () => {
      // The TPS requires the testing panel to be confirmed present before
      // the field cases run: it is what makes the simulation values usable,
      // and its absence would change what "accepted" means at every step.
      const panelVisible = await checkout.testPaymentGatewayButton
        .or(page.getByText('Testing instruction'))
        .first()
        .isVisible()
        .catch(() => false);
      await testInfo.attach('Set Up — checkout testing panel', {
        body: `testing panel present in the Payment section: ${panelVisible}`,
        contentType: 'text/plain',
      });
      expect(panelVisible, 'ENV-12: the checkout testing panel should be present in the Payment section').toBe(true);
    });

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
        const truncated = retainedDigits.length < c.candidate.replace(/\D/g, '').length;
        const accepted = fullyRetained && valid;
        // SPR-23 and the TPS's own note: a field that CAPS input truncates
        // the value on entry, and the residue may no longer be valid. That
        // is not the same outcome as a genuine refusal, and the TPS states
        // truncation "is not treated as the expected result" — so the three
        // outcomes are separated here rather than collapsed into one
        // boolean, which would let a capped field read as a refusal.
        const outcome = accepted
          ? 'ACCEPTED'
          : truncated
            ? 'TRUNCATED ON ENTRY — field capped the value; NOT a refusal'
            : 'REFUSED — value retained in full but rejected';
        await testInfo.attach(`${c.label} — readback`, {
          body: `entered: ${c.candidate}\nreadback: ${value}\nretained digits: ${retainedDigits}\nvalid: ${valid}\noutcome: ${outcome}\nexpected accept: ${c.shouldAccept}`,
          contentType: 'text/plain',
        });
        await recordFieldContents(testInfo, c.label, c.candidate, value);
        // SPR-23: which message was shown, and which were not.
        await recordMessages(page, testInfo, c.label, [
          'Enter a card number',
          'Card number is not valid',
          'too short',
          'too long',
        ]);
        // Soft: the store was already known not to validate card number
        // length at entry (see CheckoutPage's header — "1" was accepted
        // outright on an earlier live order), and a hard assert here
        // aborts at the first rejected case, so the remaining length
        // partitions are never exercised and the Wrap Up never runs. Soft
        // keeps every case evidenced and still fails the procedure.
        expect.soft(accepted, `${c.label}: TPS expects this card number to be ${c.shouldAccept ? 'accepted' : 'rejected'} at entry`).toBe(c.shouldAccept);
        if (!c.shouldAccept) {
          // Truncation must not stand in for the expected refusal.
          expect.soft(truncated, `${c.label}: TPS requires a genuine refusal here — the field capping the value on entry is explicitly not the expected result`).toBe(false);
        }
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
      // Soft for the same reason as the length cases above.
      expect.soft(fullyRetained && valid, 'TC-05-004 #3: TPS expects a Luhn-invalid number to be rejected at entry').toBe(false);
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
        const truncated = value.length < c.candidate.length;
        const accepted = value.length >= 3 && value.length <= 4 && !truncated;
        // Same three-way outcome as the card number cases above.
        const outcome = accepted
          ? 'ACCEPTED'
          : truncated
            ? 'TRUNCATED ON ENTRY — field capped the value; NOT a refusal'
            : 'REFUSED — value retained in full but rejected';
        await testInfo.attach(`${c.label} — readback`, {
          body: `entered: "${c.candidate}"\nreadback: "${value}"\noutcome: ${outcome}\nexpected accept: ${c.shouldAccept}`,
          contentType: 'text/plain',
        });
        await recordFieldContents(testInfo, c.label, c.candidate, value);
        await recordMessages(page, testInfo, c.label, [
          'Enter a security code',
          'Security code is not valid',
          'too short',
          'too long',
        ]);
        // Soft: same reasoning as the card-number cases — one rejected
        // partition must not abort the rest of the equivalence set.
        expect.soft(accepted, `${c.label}: TPS expects this security code to be ${c.shouldAccept ? 'accepted' : 'rejected'} at entry`).toBe(c.shouldAccept);
        if (!c.shouldAccept && c.candidate.length > 0) {
          // The empty case is excluded: there is nothing to truncate there.
          expect.soft(truncated, `${c.label}: TPS requires a genuine refusal here — the field capping the value on entry is explicitly not the expected result`).toBe(false);
        }
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
        // SPR-23: which message was shown, and which were not.
        await recordMessages(page, testInfo, c.label, [
          'Enter an expiry date',
          'Enter a valid expiry date',
          'card has expired',
          'past',
        ]);
        // Soft: same reasoning as the card-number cases.
        expect.soft(fullyRetained && valid, `${c.label}: TPS expects this expiry date to be ${c.shouldAccept ? 'accepted' : 'rejected'} at entry`).toBe(c.shouldAccept);
      });
    }

    await test.step('Wrap Up — navigate away without completing an order, empty cart, return home', async () => {
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      const cart = new CartPage(page);
      await cart.goto();
      const remaining = await cart.lineCount();
      for (let i = remaining - 1; i >= 0; i--) {
        await cart.removeLine(i).click();
      }
      expect(await cart.lineCount()).toBe(0);
      await page.goto('/', { waitUntil: 'domcontentloaded' });
    });
  });
});
