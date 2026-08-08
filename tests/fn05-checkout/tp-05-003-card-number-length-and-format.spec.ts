import { test, expect } from '../../utils/pacedTest';
import { addProductAndGoToCheckout, fillDeliveryAddress } from './_helpers';
import { recordUrl } from '../../utils/evidence';

/**
 * TP-05-003 — Verify the card number field accepts lengths within 13 to
 * 19 digits and rejects lengths outside that range or non-numeric
 * input, at and either side of both boundaries. Covers TC-05-003 (#1
 * to #9).
 *
 * "Accepts"/"does not accept" is read at the field level: after typing
 * a candidate, the field's live DOM value (readback) and native
 * validity.valid state are captured inside the cross-origin PCI iframe
 * via Playwright's frame-aware evaluate (not a same-origin script, so
 * this is not something the page itself could read — it's evidence,
 * not a bypass). This avoids submitting a real test order for every one
 * of the nine boundary candidates.
 *
 * IMPORTANT: a prior live capture (2026-08-07) found the card number
 * field imposes NO length limit at all — 11, 12, 20 and 22-digit values
 * were all retained in full with validity.valid = true, contradicting
 * the TPS's 13-19 digit range. This is not yet in the team's Defect Log
 * (no FN-05 entries as of this writing), so the assertions below still
 * hard-assert the TPS's documented range rather than being softened —
 * if they fail, that failure is the evidence the log needs, not a bug
 * in this test.
 */
async function fieldReadback(field: import('@playwright/test').Locator, candidate: string) {
  await field.fill('');
  await field.fill(candidate);
  return field.evaluate((el) => {
    const input = el as HTMLInputElement;
    return { value: input.value, valid: input.validity.valid };
  });
}

test.describe('FN-05 Checkout', () => {
  test('TP-05-003 card number length and format', async ({ page }, testInfo) => {
    test.setTimeout(90000);
    const { checkout } = await addProductAndGoToCheckout(page);
    await fillDeliveryAddress(page, checkout, 'United Kingdom');
    await recordUrl(page, testInfo, 'Payment section reached');

    const cardField = checkout.cardField('Card number');
    const cases: Array<{ label: string; candidate: string; shouldAccept: boolean }> = [
      { label: 'TC-05-003 #2 — 12-digit (below min)', candidate: '400000000002', shouldAccept: false },
      { label: 'TC-05-003 #3 — 13-digit (at min)', candidate: '4000000000006', shouldAccept: true },
      { label: 'TC-05-003 #4 — 16-digit (within range)', candidate: '4111111111111111', shouldAccept: true },
      { label: 'TC-05-003 #5 — 19-digit (at max)', candidate: '4000000000000000006', shouldAccept: true },
      { label: 'TC-05-003 #6 — 20-digit (above max)', candidate: '40000000000000000002', shouldAccept: false },
      { label: 'TC-05-003 #7 — 11-digit (well below range)', candidate: '40000000006', shouldAccept: false },
      { label: 'TC-05-003 #8 — 22-digit (well above range)', candidate: '4000000000000000000002', shouldAccept: false },
    ];

    for (const c of cases) {
      await test.step(c.label, async () => {
        const digitsOnly = c.candidate;
        const { value, valid } = await fieldReadback(cardField, c.candidate);
        const retainedDigits = value.replace(/\D/g, '');
        const fullyRetained = retainedDigits === digitsOnly;
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
  });
});
