import { test, expect } from '@playwright/test';
import { addProductAndGoToCheckout, fillDeliveryAddress, fillCard, TEST_CARDS } from './_helpers';
import { ConfirmationPage } from '../../pages/ConfirmationPage';
import { recordUrl, withFailureEvidence } from '../../utils/evidence';

/**
 * TP-05-007 — Verify an approved payment completes the order, and that
 * a declined payment and a gateway failure each do not. Covers
 * TC-05-007 (#1 to #3). Uses the Test Payment Gateway's published
 * simulation values (1 = approved, 2 = declined, 3 = gateway failure).
 *
 * This submits real (Bogus Gateway, no charge) test orders — consistent
 * with how earlier FN-05 exploration in this project already confirmed
 * order completion via an actual submitted order.
 */
test.describe('FN-05 Checkout', () => {
  test('TP-05-007 payment outcome', async ({ page }, testInfo) => {
    test.setTimeout(90000);
    const { checkout } = await addProductAndGoToCheckout(page);
    const confirmation = new ConfirmationPage(page);
    await fillDeliveryAddress(page, checkout, 'United Kingdom');

    await withFailureEvidence(page, testInfo, 'TC-05-007 #1 declined payment', async () => {
      await test.step('TC-05-007 #1 — declined-payment simulation value does not complete the order', async () => {
        await fillCard(checkout, TEST_CARDS.declined, '12/29', '123');
        await checkout.payNowButton.click();
        await page.waitForTimeout(3000);
        const url = await recordUrl(page, testInfo, 'After declined payment');

        expect(url).toContain('/checkouts/');
        const cardValueAfter = await checkout.cardField('Card number').inputValue().catch(() => null);
        await testInfo.attach('Card field after decline', {
          body: `value: ${cardValueAfter ?? '(unreadable)'}`,
          contentType: 'text/plain',
        });
        expect.soft(cardValueAfter ?? '').toBe('');
      });
    });

    await withFailureEvidence(page, testInfo, 'TC-05-007 #2 gateway failure', async () => {
      await test.step('TC-05-007 #2 — gateway-failure simulation value does not complete the order', async () => {
        await fillCard(checkout, TEST_CARDS.gatewayFailure, '12/29', '123');
        await checkout.payNowButton.click();
        await page.waitForTimeout(3000);
        const url = await recordUrl(page, testInfo, 'After gateway failure');

        expect(url).toContain('/checkouts/');
      });
    });

    await withFailureEvidence(page, testInfo, 'TC-05-007 #3 approved payment', async () => {
      await test.step('TC-05-007 #3 — approved-payment simulation value completes the order', async () => {
        await fillCard(checkout, TEST_CARDS.approved, '12/29', '123');
        await checkout.payNowButton.click();
        await page.waitForURL(/\/(thank[_-]?you|orders)/i, { timeout: 20000 }).catch(() => {});
        await recordUrl(page, testInfo, 'After approved payment');

        await expect(confirmation.thankYouHeading).toBeVisible();
        await expect(confirmation.confirmationNumber).toBeVisible();
        const confirmationText = await confirmation.confirmationNumber.textContent();
        await testInfo.attach('Order confirmation number', {
          body: confirmationText ?? '(not found)',
          contentType: 'text/plain',
        });
      });
    });
  });
});
