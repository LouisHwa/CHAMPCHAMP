import { test, expect } from '../../utils/pacedTest';
import { addProductAndGoToCheckout, fillDeliveryAddress, fillCard, TEST_CARDS } from './_helpers';
import { ConfirmationPage } from '../../pages/ConfirmationPage';
import { recordUrl, withFailureEvidence } from '../../utils/evidence';

/**
 * TP-05-013 — Verify a separate billing address is accepted when the
 * "Use shipping address as billing address" option is unchecked, and
 * the confirmation page shows the entered billing address distinct from
 * the shipping address. Covers TC-05-013 (#1 to #4).
 */
test.describe('FN-05 Checkout', () => {
  test('TP-05-013 separate billing address', async ({ page }, testInfo) => {
    test.setTimeout(90000);
    const { checkout } = await addProductAndGoToCheckout(page);
    const confirmation = new ConfirmationPage(page);

    await fillDeliveryAddress(page, checkout, 'United Kingdom');

    await test.step('TC-05-013 #1 — Payment section shows billing checked to reuse shipping by default', async () => {
      await expect(checkout.billingAddressCheckbox).toBeChecked();
    });

    await test.step('TC-05-013 #2 — unchecking reveals billing address fields for entry', async () => {
      await checkout.billingAddressCheckbox.uncheck();
      await page.waitForTimeout(500);
      await expect(checkout.billingAddressSection).toBeVisible();
      await expect(checkout.billingField('Address')).toBeVisible();
    });

    const billingAddress = { firstName: 'Billing', lastName: 'Payer', address1: '10 Downing Street', city: 'London', postcode: 'SW1A 2AA' };

    await withFailureEvidence(page, testInfo, 'TC-05-013 #3 separate billing address order completion', async () => {
      await test.step('TC-05-013 #3 — separate billing address accepted, order completes', async () => {
        await checkout.billingCountrySelect.selectOption({ label: 'United Kingdom' });
        await checkout.billingField('First name (optional)').fill(billingAddress.firstName);
        await checkout.billingField('Last name').fill(billingAddress.lastName);
        await checkout.billingField('Address').fill(billingAddress.address1);
        await page.waitForTimeout(500);
        await page.keyboard.press('Escape').catch(() => {});
        await checkout.billingField('City').fill(billingAddress.city);
        await checkout.billingField('Postcode').fill(billingAddress.postcode);

        await fillCard(checkout, TEST_CARDS.approved, '12/29', '123');
        await checkout.payNowButton.click();
        await page.waitForURL(/\/(thank[_-]?you|orders)/i, { timeout: 20000 }).catch(() => {});
        await recordUrl(page, testInfo, 'After Pay now with separate billing address');

        await expect(confirmation.thankYouHeading).toBeVisible();
      });
    });

    await test.step('TC-05-013 #4 — confirmation page shows the separate billing address', async () => {
      const billingSectionText = await confirmation.section('Billing address').innerText().catch((e) => `ERR ${e.message}`);
      const shippingSectionText = await confirmation.section('Shipping address').innerText().catch((e) => `ERR ${e.message}`);
      await testInfo.attach('Confirmation page address sections', {
        body: `Billing address:\n${billingSectionText}\n\nShipping address:\n${shippingSectionText}`,
        contentType: 'text/plain',
      });

      expect(billingSectionText).toContain(billingAddress.address1);
      expect(billingSectionText).not.toContain('221B Baker Street');
      expect(billingSectionText).not.toBe(shippingSectionText);
    });
  });
});
