import { test, expect } from '@playwright/test';
import { HeaderBar } from '../../pages/HeaderBar';
import { CatalogPage } from '../../pages/CatalogPage';
import { ProductPage } from '../../pages/ProductPage';
import { CartPage } from '../../pages/CartPage';
import { CheckoutPage } from '../../pages/CheckoutPage';
import { ConfirmationPage } from '../../pages/ConfirmationPage';
import { fillDeliveryAddress, fillCard, TEST_CARDS } from './_helpers';
import { recordUrl, parseMoney } from '../../utils/evidence';

/**
 * TP-05-008 — Verify a guest can complete a purchase end to end: order
 * summary, UK shipping, card entry, confirmation page, and confirmation
 * email, with the shipping address reused as billing. Covers TC-05-008
 * (#1 to #7).
 *
 * TC-05-008 #7 specifies checking the inbox of guest@test.com — a
 * literal test-data address this project does not control (no mailbox
 * access). The IMAP-based inbox-check infra (fixtures/credentials.ts,
 * utils/email.ts) is still work in progress on a teammate's branch and
 * isn't present here yet, so #7 is executed as far as the UI allows
 * (entering the guest email and confirming checkout proceeds without an
 * account) and the inbox verification itself is recorded as
 * not-executable on this branch rather than skipped silently.
 */
test.describe('FN-05 Checkout', () => {
  test('TP-05-008 guest purchase end to end', async ({ page }, testInfo) => {
    test.setTimeout(90000);
    const header = new HeaderBar(page);
    const catalog = new CatalogPage(page);
    const product = new ProductPage(page);
    const cart = new CartPage(page);
    const checkout = new CheckoutPage(page);
    const confirmation = new ConfirmationPage(page);

    await test.step('Set Up — add Grey Jacket, Check Out via navigation, CHECK OUT on My Cart page', async () => {
      await header.gotoHome();
      await catalog.goto();
      await catalog.productLink('Grey Jacket').click().catch(async () => {
        // Fall back to the first catalogue product if "Grey Jacket" isn't the exact display name live.
        await catalog.grid.locator('a').first().click();
      });
      await page.waitForLoadState('domcontentloaded');
      if ((await product.sizeSelect.count()) > 0 && (await product.sizeSelect.locator('option').count()) > 1) {
        const value = await product.sizeSelect.locator('option').nth(1).getAttribute('value');
        if (value) await product.selectSize(value);
      }
      await product.addToCartButton.click();
      await page.waitForLoadState('networkidle').catch(() => {});
      await cart.goto();
      await cart.checkoutButton.click();
      await page.waitForLoadState('domcontentloaded');
      await recordUrl(page, testInfo, 'Checkout page reached');

      await expect(checkout.costSummaryRow('Subtotal').first()).toBeVisible();
      await expect(checkout.costSummaryRow('Total').first()).toBeVisible();
    });

    await test.step('TC-05-008 #2 — guest email entered without signing in', async () => {
      await checkout.emailField.fill('guest@test.com');
      await expect(checkout.signInLink).toBeVisible();
      const url = await recordUrl(page, testInfo, 'Guest email entered');
      expect(url).toContain('/checkouts/');
    });

    await test.step('TC-05-008 #3 — UK delivery address applies published UK shipping rate', async () => {
      await fillDeliveryAddress(page, checkout, 'United Kingdom');
      const subtotal = parseMoney(await checkout.costSummaryRow('Subtotal').first().textContent());
      const shipping = parseMoney(await checkout.costSummaryRow('Shipping').first().textContent());
      const total = parseMoney(await checkout.costSummaryRow('Total').first().textContent());
      await testInfo.attach('UK cost summary', {
        body: `subtotal: ${subtotal}\nshipping: ${shipping}\ntotal: ${total}`,
        contentType: 'text/plain',
      });
      expect(shipping).toBeCloseTo(10.0, 2);
      expect(total).toBeCloseTo(subtotal + shipping, 2);
    });

    await test.step('TC-05-008 #4 — Payment section displays payment fields', async () => {
      await expect(checkout.cardFrame('Card number').getByRole('textbox', { name: 'Card number' })).toBeVisible();
    });

    await test.step('TC-05-008 #5 — approved payment accepted, billing reused from shipping', async () => {
      await expect(checkout.billingAddressCheckbox).toBeChecked();
      await fillCard(checkout, TEST_CARDS.approved, '12/29', '123');
    });

    await test.step('TC-05-008 #6 — Pay now completes the order', async () => {
      await checkout.payNowButton.click();
      await page.waitForURL(/\/(thank[_-]?you|orders)/i, { timeout: 20000 }).catch(() => {});
      await recordUrl(page, testInfo, 'After Pay now');

      await expect(confirmation.thankYouHeading).toBeVisible();
      await expect(confirmation.confirmationNumber).toBeVisible();
      const confirmationText = await confirmation.confirmationNumber.textContent();
      await testInfo.attach('Confirmation number', {
        body: confirmationText ?? '(not found)',
        contentType: 'text/plain',
      });
    });

    await test.step('TC-05-008 #7 — confirmation email (not executable on this branch)', async () => {
      await testInfo.attach('Confirmation email check', {
        body:
          'guest@test.com is a literal test-data address this project does not control an inbox for. ' +
          'IMAP inbox-checking infra (fixtures/credentials.ts, utils/email.ts) is still in progress on a ' +
          'teammate\'s branch and is not present on fn05-checkout — this step could not be executed and is ' +
          'recorded here rather than silently skipped.',
        contentType: 'text/plain',
      });
    });
  });
});
