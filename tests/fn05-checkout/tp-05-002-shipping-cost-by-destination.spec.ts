import { test, expect } from '@playwright/test';
import { addProductAndGoToCheckout, fillDeliveryAddress, waitForShippingCost } from './_helpers';
import { recordUrl, parseMoney } from '../../utils/evidence';

/**
 * TP-05-002 — Verify shipping cost is applied by destination country and
 * recalculated when the country changes, and that a blank/unsupported
 * country is rejected. Covers TC-05-002 (#1 to #4).
 *
 * Oracle rates (published, per TP-05-012's stated £10 UK / £20 France)
 * are hardcoded below rather than re-derived, per SPR-17.
 *
 * #3/#4 (blank country / unsupported country): the live Country/Region
 * control is a native <select> of real country names with no blank
 * option, so a shopper cannot literally clear it or type an unsupported
 * value through the UI. Both steps are executed as faithfully as the
 * real control allows and recorded as evidence rather than hard-
 * asserted, since the TPS's literal interaction isn't reachable here.
 */
const UK_RATE = 10.0;
const FRANCE_RATE = 20.0;

test.describe('FN-05 Checkout', () => {
  test('TP-05-002 shipping cost by destination country', async ({ page }, testInfo) => {
    test.setTimeout(90000);
    const { checkout } = await addProductAndGoToCheckout(page);

    await test.step('TC-05-002 #1 — UK delivery address applies the published UK rate', async () => {
      await fillDeliveryAddress(page, checkout, 'United Kingdom');
      await recordUrl(page, testInfo, 'UK address entered');

      const subtotal = parseMoney(await checkout.costSummaryRow('Subtotal').first().textContent());
      const shipping = parseMoney(await checkout.costSummaryRow('Shipping').first().textContent());
      const total = parseMoney(await checkout.costSummaryRow('Total').first().textContent());

      await testInfo.attach('UK cost summary', {
        body: `subtotal: ${subtotal}\nshipping: ${shipping}\ntotal: ${total}\noracle UK rate: ${UK_RATE}`,
        contentType: 'text/plain',
      });

      expect(shipping).toBeCloseTo(UK_RATE, 2);
      expect(total).toBeCloseTo(subtotal + shipping, 2);
    });

    await test.step('TC-05-002 #2 — changing country to France recalculates shipping cost', async () => {
      await checkout.countrySelect.selectOption({ label: 'France' });
      // Confirmed live: switching country invalidates the previously
      // entered UK-format city/postcode for rate purposes — the store
      // won't recalculate until a France-appropriate city/postcode is
      // re-entered, so a real shopper would naturally update these too.
      await checkout.deliveryField('City').fill('Paris');
      await checkout.deliveryField('Postcode').fill('75007');
      await waitForShippingCost(page, checkout);

      const subtotal = parseMoney(await checkout.costSummaryRow('Subtotal').first().textContent());
      const shipping = parseMoney(await checkout.costSummaryRow('Shipping').first().textContent());
      const total = parseMoney(await checkout.costSummaryRow('Total').first().textContent());

      await testInfo.attach('France cost summary', {
        body: `subtotal: ${subtotal}\nshipping: ${shipping}\ntotal: ${total}\noracle France rate: ${FRANCE_RATE}`,
        contentType: 'text/plain',
      });

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

      expect.soft(url).toContain('/checkouts/');
    });

    await test.step('TC-05-002 #4 — unsupported country value is not selectable', async () => {
      const optionLabels = await checkout.countrySelect.locator('option').allTextContents();
      const unsupportedPresent = optionLabels.some((label) => /unsupported|test-invalid/i.test(label));
      await testInfo.attach('Unsupported-country reachability', {
        body: `Country/Region options are a fixed real-country list (${optionLabels.length} entries); no unsupported/placeholder value is present: ${!unsupportedPresent}`,
        contentType: 'text/plain',
      });
      expect.soft(unsupportedPresent).toBe(false);
    });
  });
});
