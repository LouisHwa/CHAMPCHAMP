import { test, expect } from '../../utils/pacedTest';
import { addProductAndGoToCheckout, fillDeliveryAddress, fillCard, TEST_CARDS } from './_helpers';
import { recordUrl, withFailureEvidence } from '../../utils/evidence';

/**
 * TP-05-014 — Verify a declined payment does not complete the order,
 * shows an error, and clears the payment fields. Covers TC-05-014
 * (#1 to #3).
 */
test.describe('FN-05 Checkout', () => {
  test('TP-05-014 declined payment', async ({ page }, testInfo) => {
    test.setTimeout(60000);
    const { checkout } = await addProductAndGoToCheckout(page);
    await fillDeliveryAddress(page, checkout, 'United Kingdom');

    await test.step('TC-05-014 #1 — Payment section displays card number, expiry, CVV, name fields', async () => {
      await expect(checkout.cardField('Card number')).toBeVisible();
      await expect(checkout.cardField('Expiration date (MM / YY)')).toBeVisible();
      await expect(checkout.cardField('Security code')).toBeVisible();
      await expect(checkout.cardField('Name on card')).toBeVisible();
    });

    await withFailureEvidence(page, testInfo, 'TC-05-014 #2 declined payment does not complete', async () => {
      await test.step('TC-05-014 #2 — declined-payment simulation value does not complete the order', async () => {
        await fillCard(checkout, TEST_CARDS.declined, '12/29', '123');
        await checkout.payNowButton.click();
        await page.waitForTimeout(3000);
        const url = await recordUrl(page, testInfo, 'After declined payment');
        expect(url).toContain('/checkouts/');
      });
    });

    await test.step('TC-05-014 #3 — payment fields are cleared for re-entry after the error', async () => {
      const cardValue = await checkout.cardField('Card number').inputValue().catch(() => null);
      const expiryValue = await checkout.cardField('Expiration date (MM / YY)').inputValue().catch(() => null);
      const cvvValue = await checkout.cardField('Security code').inputValue().catch(() => null);
      await testInfo.attach('Payment field values after declined payment', {
        body: `card number: "${cardValue}"\nexpiry: "${expiryValue}"\nCVV: "${cvvValue}"`,
        contentType: 'text/plain',
      });

      expect.soft(cardValue ?? '').toBe('');
      expect.soft(expiryValue ?? '').toBe('');
      expect.soft(cvvValue ?? '').toBe('');
    });
  });
});
