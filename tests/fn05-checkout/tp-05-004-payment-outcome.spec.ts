import { test, expect } from '../../utils/pacedTest';
import { CartPage } from '../../pages/CartPage';
import { ConfirmationPage } from '../../pages/ConfirmationPage';
import {
  addProductAndGoToCheckout,
  fillDeliveryAddress,
  fillCard,
  TEST_CARDS,
  NAME_ON_CARD,
  SIMULATION_VALUES,
  recordSimulationValue,
  recordMessages,
} from './_helpers';
import { GUEST_CONTACT } from '../../fixtures/credentials';
import { recordUrl, withFailureEvidence } from '../../utils/evidence';

/**
 * TP-05-004 — Verify a declined payment does not complete the order,
 * shows an error and clears the payment fields, and that a gateway
 * failure likewise does not complete the order while an approved
 * payment does. Covers TC-05-014, TC-05-007 (merged per the refined
 * TPS FN-05, replacing the old separate TP-05-014/TP-05-007).
 *
 * TC-05-014 is executed first (it completes nothing), so the single
 * order this procedure completes lands at the very end, per the
 * document's own note: "no order is left in the store partway through."
 *
 * Must run before TP-05-005 — TC-05-008 declares TC-05-007 as its
 * prerequisite.
 */
test.describe('FN-05 Checkout', () => {
  test('TP-05-004 payment outcome', async ({ page }, testInfo) => {
    test.setTimeout(120_000);

    const { checkout } = await addProductAndGoToCheckout(page);
    const confirmation = new ConfirmationPage(page);
    await fillDeliveryAddress(page, checkout, 'United Kingdom');

    await test.step('TC-05-014 #1 — Payment section displays card number, expiry, CVV, name fields', async () => {
      await expect(checkout.cardField('Card number')).toBeVisible();
      await expect(checkout.cardField('Expiration date (MM / YY)')).toBeVisible();
      await expect(checkout.cardField('Security code')).toBeVisible();
      await expect(checkout.cardField('Name on card')).toBeVisible();
    });

    await withFailureEvidence(page, testInfo, 'TC-05-014 #2 declined payment does not complete', async () => {
      await test.step('TC-05-014 #2 — declined-payment simulation value does not complete the order', async () => {
        await fillCard(checkout, TEST_CARDS.declined, '12/29', '123', NAME_ON_CARD);
        await recordSimulationValue(testInfo, 'TC-05-014 #2', SIMULATION_VALUES.declined);
        await checkout.payNowButton.click();
        await page.waitForTimeout(3000);
        const url = await recordUrl(page, testInfo, 'After declined payment (TC-05-014)');
        // The Wrap Up requires the error message displayed for the
        // declined outcome, and SPR-23 requires which messages were shown
        // and which were not.
        await recordMessages(page, testInfo, 'TC-05-014 #2 declined payment', [
          'declined',
          'gateway',
          'expired',
          'security code',
        ]);
        expect(url).toContain('/checkouts/');
      });
    });

    await test.step('TC-05-014 #3 — payment fields are cleared for re-entry after the error', async () => {
      const cardValue = await checkout.cardField('Card number').inputValue().catch(() => null);
      const expiryValue = await checkout.cardField('Expiration date (MM / YY)').inputValue().catch(() => null);
      const cvvValue = await checkout.cardField('Security code').inputValue().catch(() => null);
      await testInfo.attach('Payment field values after declined payment (TC-05-014)', {
        body: `card number: "${cardValue}"\nexpiry: "${expiryValue}"\nCVV: "${cvvValue}"`,
        contentType: 'text/plain',
      });

      expect.soft(cardValue ?? '').toBe('');
      expect.soft(expiryValue ?? '').toBe('');
      expect.soft(cvvValue ?? '').toBe('');
    });

    await test.step('Reset — return to store, empty cart, re-add product before TC-05-007', async () => {
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      const cart = new CartPage(page);
      await cart.goto();
      const remaining = await cart.lineCount();
      for (let i = remaining - 1; i >= 0; i--) {
        await cart.removeLine(i).click();
      }
    });

    const tc007 = await addProductAndGoToCheckout(page);
    // TD-05-E. The contact address is required to complete a guest order at
    // all, and SPR-18 requires it recorded alongside the confirmation
    // number so orders raised by testing can be identified afterwards.
    const guestEmail = GUEST_CONTACT.email();
    await tc007.checkout.emailField.fill(guestEmail);
    await fillDeliveryAddress(page, tc007.checkout, 'United Kingdom');

    await withFailureEvidence(page, testInfo, 'TC-05-007 #1 declined payment', async () => {
      await test.step('TC-05-007 #1 — declined-payment simulation value does not complete the order', async () => {
        await fillCard(tc007.checkout, TEST_CARDS.declined, '12/29', '123', NAME_ON_CARD);
        await recordSimulationValue(testInfo, 'TC-05-007 #1', SIMULATION_VALUES.declined);
        await tc007.checkout.payNowButton.click();
        await page.waitForTimeout(3000);
        const url = await recordUrl(page, testInfo, 'After declined payment (TC-05-007)');
        await recordMessages(page, testInfo, 'TC-05-007 #1 declined payment', [
          'declined',
          'gateway',
          'expired',
          'security code',
        ]);
        expect(url).toContain('/checkouts/');
      });
    });

    await withFailureEvidence(page, testInfo, 'TC-05-007 #2 gateway failure', async () => {
      await test.step('TC-05-007 #2 — gateway-failure simulation value does not complete the order', async () => {
        await fillCard(tc007.checkout, TEST_CARDS.gatewayFailure, '12/29', '123', NAME_ON_CARD);
        await recordSimulationValue(testInfo, 'TC-05-007 #2', SIMULATION_VALUES.gatewayFailure);
        await tc007.checkout.payNowButton.click();
        await page.waitForTimeout(3000);
        const url = await recordUrl(page, testInfo, 'After gateway failure');
        await recordMessages(page, testInfo, 'TC-05-007 #2 gateway failure', [
          'gateway',
          'declined',
          'try again',
          'security code',
        ]);
        expect(url).toContain('/checkouts/');
      });
    });

    await withFailureEvidence(page, testInfo, 'TC-05-007 #3 approved payment', async () => {
      await test.step('TC-05-007 #3 — approved-payment simulation value completes the order', async () => {
        await fillCard(tc007.checkout, TEST_CARDS.approved, '12/29', '123', NAME_ON_CARD);
        await recordSimulationValue(testInfo, 'TC-05-007 #3', SIMULATION_VALUES.approved);
        await tc007.checkout.payNowButton.click();
        await page.waitForURL(/\/(thank[_-]?you|orders)/i, { timeout: 20000 }).catch(() => {});
        await recordUrl(page, testInfo, 'After approved payment');

        await expect(confirmation.thankYouHeading).toBeVisible();
        await expect(confirmation.confirmationNumber).toBeVisible();
        const confirmationText = await confirmation.confirmationNumber.textContent();
        // SPR-18: the confirmation number AND the contact address used, so
        // this order can be identified on the live store afterwards.
        await testInfo.attach('Confirmation number and contact address (TC-05-007)', {
          body: `confirmation: ${confirmationText ?? '(not found)'}\ncontact address: ${guestEmail}`,
          contentType: 'text/plain',
        });
        // The Wrap Up requires the confirmation page summary: items,
        // shipping method, shipping address, billing address, payment method.
        await testInfo.attach('Confirmation page summary (TC-05-007)', {
          body: (await page.locator('main').innerText().catch(() => '')) || '(summary not readable)',
          contentType: 'text/plain',
        });
        await testInfo.attach('Confirmation page — screenshot (TC-05-007)', {
          body: await page.screenshot({ fullPage: true }),
          contentType: 'image/png',
        });
      });
    });
  });
});
