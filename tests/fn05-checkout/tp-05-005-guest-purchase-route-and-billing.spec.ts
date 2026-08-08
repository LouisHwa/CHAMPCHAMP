import { test, expect } from '../../utils/pacedTest';
import { HeaderBar } from '../../pages/HeaderBar';
import { CatalogPage } from '../../pages/CatalogPage';
import { ProductPage } from '../../pages/ProductPage';
import { CartPage } from '../../pages/CartPage';
import { CartDrawer } from '../../pages/CartDrawer';
import { CheckoutPage } from '../../pages/CheckoutPage';
import { ConfirmationPage } from '../../pages/ConfirmationPage';
import { addProductAndGoToCheckout, fillDeliveryAddress, fillCard, TEST_CARDS, NAME_ON_CARD, BILLING_ADDRESS } from './_helpers';
import { recordUrl, parseMoney, withFailureEvidence } from '../../utils/evidence';
import { GUEST_CONTACT, GUEST_IMAP_CONFIG } from '../../fixtures/credentials';
import { waitForEmail, extractLink } from '../../utils/email';

/**
 * TP-05-005 — Verify a guest can complete a purchase end to end with
 * the shipping address reused as the billing address, that checkout
 * reached through the My Cart dropdown resolves to the same checkout
 * page as the navigation route, and that a separate billing address is
 * accepted when the reuse option is unchecked. Covers TC-05-008,
 * TC-05-009, TC-05-013 (merged per the refined TPS FN-05, replacing the
 * old separate TP-05-008/TP-05-009/TP-05-013). Two orders are completed
 * by this procedure (TC-05-008, TC-05-013).
 *
 * Depends on TP-05-004 having run first (TC-05-008 declares TC-05-007
 * as its prerequisite) — that's a document-level intercase dependency,
 * not something this file can enforce across separate test runs.
 *
 * EXPECTED TO FAIL, BY DESIGN, on the TC-05-009 (My Cart dropdown)
 * section only — marked via test.fail() below. Reproduces DEF-F4-01
 * ("Cart does not update in real time; items only appear after a
 * manual page refresh"), already logged for FN-04: the dropdown is
 * opened right after an add-to-cart click on the same page, and its
 * row markup is a server-rendered snapshot from that page's initial
 * load, so it doesn't reflect the same-page AJAX add. TC-05-008 (guest
 * purchase) and TC-05-013 (separate billing) have no known defect and
 * are hard-asserted; test.fail() applies to the whole test, so the
 * dropdown failure is what determines the overall result even though
 * the other two sections — including both order completions — genuinely
 * pass.
 */
test.describe('FN-05 Checkout', () => {
  test('TP-05-005 guest purchase, checkout route and billing address', async ({ page }, testInfo) => {
    test.fail(true, 'Confirmed defect DEF-F4-01: the My Cart dropdown does not reflect a same-page AJAX add.');
    test.setTimeout(150_000);

    const header = new HeaderBar(page);
    const catalog = new CatalogPage(page);
    const product = new ProductPage(page);
    const cart = new CartPage(page);
    const drawer = new CartDrawer(page);
    const checkout = new CheckoutPage(page);
    const confirmation = new ConfirmationPage(page);

    await withFailureEvidence(page, testInfo, 'TP-05-005 unexpected failure', async () => {
      const orderStartedAt = new Date();

      await test.step('TC-05-008 #1 — add TD-05-A via nav Check Out / My Cart CHECK OUT, order summary displayed', async () => {
        await header.gotoHome();
        await catalog.goto();
        await catalog.productLink('Grey jacket').click().catch(async () => {
          await catalog.grid.locator('a').first().click();
        });
        await page.waitForLoadState('domcontentloaded');
        await product.addToCartButton.click();
        await page.waitForLoadState('networkidle').catch(() => {});
        await cart.goto();
        await cart.checkoutButton.click();
        await page.waitForLoadState('domcontentloaded');
        await recordUrl(page, testInfo, 'Checkout page reached (TC-05-008)');

        await expect(checkout.costSummaryRow('Subtotal').first()).toBeVisible();
        await expect(checkout.costSummaryRow('Total').first()).toBeVisible();
      });

      const guestEmail = GUEST_CONTACT.email();

      await test.step('TC-05-008 #2 — guest email TD-05-E entered without signing in', async () => {
        await checkout.emailField.fill(guestEmail);
        await expect(checkout.signInLink).toBeVisible();
        const url = await recordUrl(page, testInfo, 'Guest email entered');
        expect(url).toContain('/checkouts/');
      });

      let tc008Summary = { subtotal: 0, shipping: 0, total: 0 };

      await test.step('TC-05-008 #3 — UK delivery address applies published UK shipping rate', async () => {
        await fillDeliveryAddress(page, checkout, 'United Kingdom');
        const subtotal = parseMoney(await checkout.costSummaryRow('Subtotal').first().textContent());
        const shipping = parseMoney(await checkout.costSummaryRow('Shipping').first().textContent());
        const total = parseMoney(await checkout.costSummaryRow('Total').first().textContent());
        tc008Summary = { subtotal, shipping, total };
        await testInfo.attach('UK cost summary (TC-05-008)', {
          body: `subtotal: ${subtotal}\nshipping: ${shipping}\ntotal: ${total}`,
          contentType: 'text/plain',
        });
        expect(shipping).toBeCloseTo(10.0, 2);
        expect(total).toBeCloseTo(subtotal + shipping, 2);
      });

      await test.step('TC-05-008 #4 — Payment section displays payment fields', async () => {
        await expect(checkout.cardField('Card number')).toBeVisible();
      });

      await test.step('TC-05-008 #5 — approved payment accepted, billing reused from shipping', async () => {
        await expect(checkout.billingAddressCheckbox).toBeChecked();
        await fillCard(checkout, TEST_CARDS.approved, '12/29', '123', NAME_ON_CARD);
      });

      await test.step('TC-05-008 #6 — Pay now completes the order', async () => {
        await checkout.payNowButton.click();
        await page.waitForURL(/\/(thank[_-]?you|orders)/i, { timeout: 20000 }).catch(() => {});
        await recordUrl(page, testInfo, 'After Pay now (TC-05-008)');

        await expect(confirmation.thankYouHeading).toBeVisible();
        await expect(confirmation.confirmationNumber).toBeVisible();
        const confirmationText = await confirmation.confirmationNumber.textContent();
        await testInfo.attach('Confirmation number and contact address (TC-05-008)', {
          body: `confirmation: ${confirmationText ?? '(not found)'}\ncontact address: ${guestEmail}`,
          contentType: 'text/plain',
        });
      });

      await test.step('TC-05-008 #7 — confirmation email received at TD-05-E with order number and View order link', async () => {
        const email = await waitForEmail('order', orderStartedAt, 90_000, GUEST_IMAP_CONFIG);
        await testInfo.attach('Confirmation email (TD-05-E)', {
          body: `subject: ${email.subject}\n\n${email.text}`,
          contentType: 'text/plain',
        });

        const viewOrderLink = extractLink(email.html, 'View order');
        await testInfo.attach('Confirmation email — View order link', {
          body: viewOrderLink ?? '(not found)',
          contentType: 'text/plain',
        });

        expect(email.subject.toLowerCase()).toContain('order');
        expect(viewOrderLink).not.toBeNull();
      });

      await test.step('Reset — confirm cart empty after order, re-add TD-05-A for TC-05-009 (same cart contents as TC-05-008 #1)', async () => {
        await cart.goto();
        expect(await cart.lineCount()).toBe(0);
        await product.addToCartButton.click();
        await page.waitForLoadState('networkidle').catch(() => {});
      });

      await test.step('TC-05-009 #1 — My Cart dropdown opens showing items and CHECK OUT', async () => {
        await header.cartToggle.click();
        await drawer.drawer.waitFor({ state: 'visible' });
        const url = await recordUrl(page, testInfo, 'Mini-cart dropdown opened');
        await testInfo.attach('Mini-cart dropdown line count', {
          body: `lines: ${await drawer.lineCount()} (header badge: ${await header.cartCount.textContent().catch(() => '(unreadable)')})`,
          contentType: 'text/plain',
        });

        expect.soft(url).not.toContain('/cart');
        await expect.soft(drawer.drawer).toBeVisible();
        expect.soft(await drawer.lineCount()).toBeGreaterThan(0);
      });

      await test.step('TC-05-009 #2 — CHECK OUT within the dropdown reaches the same checkout page, matching TC-05-008 #1', async () => {
        await drawer.checkoutButton.click().catch(() => {});
        await page.waitForLoadState('domcontentloaded').catch(() => {});
        const url = await recordUrl(page, testInfo, 'Checkout reached via My Cart dropdown');
        expect.soft(url).toContain('/checkouts/');

        await fillDeliveryAddress(page, checkout, 'United Kingdom').catch(() => {});
        const subtotal = parseMoney(await checkout.costSummaryRow('Subtotal').first().textContent().catch(() => null));
        const shipping = parseMoney(await checkout.costSummaryRow('Shipping').first().textContent().catch(() => null));
        const total = parseMoney(await checkout.costSummaryRow('Total').first().textContent().catch(() => null));
        await testInfo.attach('Cost summary via dropdown route, vs TC-05-008 #1', {
          body: `dropdown route: subtotal ${subtotal}, shipping ${shipping}, total ${total}\nTC-05-008 #1: subtotal ${tc008Summary.subtotal}, shipping ${tc008Summary.shipping}, total ${tc008Summary.total}`,
          contentType: 'text/plain',
        });
        expect.soft(total).toBeCloseTo(tc008Summary.total, 2);
      });

      await test.step('Reset — abandon this checkout, empty cart before TC-05-013', async () => {
        await header.gotoHome();
        await cart.goto();
        const remaining = await cart.lineCount();
        for (let i = remaining - 1; i >= 0; i--) {
          await cart.removeLine(i).click();
        }
        await cart.goto();
        expect(await cart.lineCount()).toBe(0);
      });

      const tc013 = await addProductAndGoToCheckout(page);
      await fillDeliveryAddress(page, tc013.checkout, 'United Kingdom');

      await test.step('TC-05-013 #1 — Payment section displayed with "Use shipping address as billing address" checked', async () => {
        await expect(tc013.checkout.billingAddressCheckbox).toBeChecked();
      });

      await test.step('TC-05-013 #2 — unchecking reveals billing address fields for entry', async () => {
        await tc013.checkout.billingAddressCheckbox.uncheck();
        await page.waitForTimeout(500);
        await expect(tc013.checkout.billingAddressSection).toBeVisible();
        await expect(tc013.checkout.billingField('Address')).toBeVisible();
      });

      await test.step('TC-05-013 #3 — separate billing address (TD-05-BILL) accepted, order completes', async () => {
        await tc013.checkout.billingCountrySelect.selectOption({ label: 'United Kingdom' });
        await tc013.checkout.billingField('First name (optional)').fill(BILLING_ADDRESS.firstName);
        await tc013.checkout.billingField('Last name').fill(BILLING_ADDRESS.lastName);
        await tc013.checkout.billingField('Address').fill(BILLING_ADDRESS.address1);
        await page.waitForTimeout(500);
        await page.keyboard.press('Escape').catch(() => {});
        await tc013.checkout.billingField('City').fill(BILLING_ADDRESS.city);
        await tc013.checkout.billingField('Postcode').fill(BILLING_ADDRESS.postcode);

        await fillCard(tc013.checkout, TEST_CARDS.approved, '12/29', '123', NAME_ON_CARD);
        await tc013.checkout.payNowButton.click();
        await page.waitForURL(/\/(thank[_-]?you|orders)/i, { timeout: 20000 }).catch(() => {});
        const confirmationText = await confirmation.confirmationNumber.textContent().catch(() => null);
        await testInfo.attach('Confirmation number and contact address (TC-05-013)', {
          body: `confirmation: ${confirmationText ?? '(not found)'}`,
          contentType: 'text/plain',
        });
        await expect(confirmation.thankYouHeading).toBeVisible();
      });

      await test.step('TC-05-013 #4 — confirmation page shows the separate billing address, distinct from shipping', async () => {
        const billingSectionText = await confirmation.section('Billing address').innerText().catch((e) => `ERR ${e.message}`);
        const shippingSectionText = await confirmation.section('Shipping address').innerText().catch((e) => `ERR ${e.message}`);
        await testInfo.attach('Confirmation page address sections (TC-05-013)', {
          body: `Billing address:\n${billingSectionText}\n\nShipping address:\n${shippingSectionText}`,
          contentType: 'text/plain',
        });

        expect(billingSectionText).toContain(BILLING_ADDRESS.address1);
        expect(billingSectionText).not.toBe(shippingSectionText);
      });

      await test.step('Wrap Up — return to store home page, confirm cart empty', async () => {
        await header.gotoHome();
        await cart.goto();
        expect(await cart.lineCount()).toBe(0);
      });
    });
  });
});
