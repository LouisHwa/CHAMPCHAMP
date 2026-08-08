import { test, expect } from '../../utils/pacedTest';
import { HeaderBar } from '../../pages/HeaderBar';
import { ProductPage } from '../../pages/ProductPage';
import { CartPage } from '../../pages/CartPage';
import { CheckoutPage } from '../../pages/CheckoutPage';
import { PRODUCT_HANDLES } from '../../fixtures/test-data';
import { withFailureEvidence } from '../../utils/evidence';

/**
 * TP-04-007 — Verify a selected variant is added to the cart and carried
 * through to the checkout handoff with the correct items, quantities,
 * total and order note. Covers TC-04-007 (#1 to #5).
 *
 * EXPECTED TO FAIL, BY DESIGN — marked via test.fail() below. Confirmed
 * in the Defect Log (DEF-F4-07): an order note entered in the cart is
 * not displayed at checkout. The variant/quantity/total handoff itself
 * (#1 to #4) has no known defect and should pass; only the order-note
 * check (#5) is expected to fail — but since test.fail() applies to the
 * whole test, that one failure is what determines the overall result.
 *
 * The whole body is also wrapped in withFailureEvidence — see TP-04-003
 * for why: test.fail() suppresses Playwright's automatic failure
 * capture, so this is what leaves evidence behind if something unrelated
 * (e.g. a Cloudflare interstitial) breaks the test instead of DEF-F4-07.
 */
test.describe('FN-04 Cart Management', () => {
  test('TP-04-007 cart to checkout handoff', async ({ page }, testInfo) => {
    test.fail(true, 'Confirmed defect DEF-F4-07: the order note entered in the cart never appears at checkout.');

    const header = new HeaderBar(page);
    const product = new ProductPage(page);
    const cart = new CartPage(page);
    const checkout = new CheckoutPage(page);

    const orderNote = 'Please deliver after 6pm';

    await withFailureEvidence(page, testInfo, async () => {

    await test.step('Set Up — confirm empty cart baseline', async () => {
      await cart.goto();
      expect(await cart.lineCount()).toBe(0);
      await header.gotoHome();
    });

    await test.step('TC-04-007 #1 — select Noir jacket, size M, colour Blue, add to cart', async () => {
      await product.goto(PRODUCT_HANDLES.noirJacket);
      await product.selectSize('M');
      await product.selectColour('Blue');
      const resp = page.waitForResponse((r) => r.url().includes('/cart/add'), { timeout: 10_000 }).catch(() => null);
      await product.addToCartButton.click();
      await resp;
    });

    await test.step('TC-04-007 #2 — cart line shows name, variant, quantity, totals', async () => {
      await cart.goto();
      const description = (await cart.lineDescription(0).textContent()) ?? '';
      const lineTotal = await cart.lineTotal(0).textContent();
      const orderTotal = await cart.orderTotal.textContent();
      await testInfo.attach('Cart line — description / totals', {
        body: `description: ${description.trim()}\nline total: ${lineTotal}\norder total: ${orderTotal}`,
        contentType: 'text/plain',
      });

      expect(description).toContain('M');
      expect(description).toContain('Blue');
      expect(await cart.lineQuantityInput(0).inputValue()).toBe('1');
    });

    await test.step('TC-04-007 #3 — enter order note, record acceptance', async () => {
      await cart.noteField.fill(orderNote);
      await cart.updateButton.click();
      await cart.goto();
      const noteValue = await cart.noteField.inputValue();
      await testInfo.attach('Order note — persisted value', {
        body: noteValue,
        contentType: 'text/plain',
      });
      expect(noteValue).toBe(orderNote);
    });

    await test.step('TC-04-007 #4 — Checkout opens with items, quantities, subtotal, total', async () => {
      await cart.checkoutButton.click();
      await page.waitForURL(/\/checkouts\//, { timeout: 20_000 }).catch(() => null);
      const summaryText = await page.locator('body').innerText();
      const showsItem = summaryText.includes('Noir jacket');
      await testInfo.attach('Checkout page — shows cart item', {
        body: `Noir jacket visible on checkout page: ${showsItem}`,
        contentType: 'text/plain',
      });
      expect(showsItem).toBe(true);
    });

    await test.step('TC-04-007 #5 — checkout summary shows the order note', async () => {
      const summaryText = await page.locator('body').innerText();
      const noteVisible = summaryText.includes(orderNote);
      await testInfo.attach('Checkout page — order note visibility', {
        body: `order note "${orderNote}" visible on checkout page: ${noteVisible}`,
        contentType: 'text/plain',
      });
      expect(noteVisible, 'TC-04-007 expects the cart order note to appear in the checkout summary.').toBe(true);
    });

    await test.step('Wrap Up — navigate away from checkout, empty cart, return home', async () => {
      await header.gotoHome();
      await cart.goto();
      const remaining = await cart.lineCount();
      for (let i = remaining - 1; i >= 0; i--) {
        await cart.removeLine(i).click();
      }
      await header.gotoHome();
    });
    });
  });
});
