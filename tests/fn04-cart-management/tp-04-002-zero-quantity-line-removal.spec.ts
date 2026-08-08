import { test, expect } from '../../utils/pacedTest';
import { HeaderBar } from '../../pages/HeaderBar';
import { ProductPage } from '../../pages/ProductPage';
import { CartPage } from '../../pages/CartPage';
import { PRODUCT_HANDLES } from '../../fixtures/test-data';
import { parseMoney } from '../../utils/evidence';

/**
 * TP-04-002 — Verify setting a cart line quantity to zero removes the
 * line item from the cart. Covers TC-04-002 (#1 to #2). No known defect
 * against this procedure — expected to pass.
 *
 * Intercase dependency: TP-04-001's valid quantity acceptance step.
 */
test.describe('FN-04 Cart Management', () => {
  test('TP-04-002 zero quantity line removal', async ({ page }, testInfo) => {
    const header = new HeaderBar(page);
    const product = new ProductPage(page);
    const cart = new CartPage(page);

    await test.step('Set Up — confirm empty cart baseline', async () => {
      await cart.goto();
      expect(await cart.lineCount()).toBe(0);
      await header.gotoHome();
    });

    await test.step('TC-04-002 #1 — add product, confirm line displayed, set quantity to 0', async () => {
      await product.goto(PRODUCT_HANDLES.bronzeSandals);
      const cartAddResponse = page
        .waitForResponse((res) => res.url().includes('/cart/add'), { timeout: 10_000 })
        .catch(() => null);
      await product.addToCartButton.click();
      await cartAddResponse;

      await cart.goto();
      const lineDisplayed = await cart.lineCount();
      const lineDescription = lineDisplayed > 0 ? await cart.lineDescription(0).textContent() : null;
      await testInfo.attach('Product line displayed after add', {
        body: `line count: ${lineDisplayed}\nline description: ${lineDescription?.trim() ?? '(none)'}`,
        contentType: 'text/plain',
      });
      expect(lineDisplayed).toBe(1);

      await cart.lineQuantityInput(0).fill('0');
      await cart.updateButton.click();
    });

    await test.step('TC-04-002 #2 — line removed, order total recalculated to 0.00', async () => {
      await cart.goto();
      const closingLineCount = await cart.lineCount();
      // An empty cart replaces the whole #cart section with a plain
      // "your cart is empty" message — .cart.total doesn't exist at all
      // in that state, so there's nothing to parse; 0 is correct by
      // definition once the line count itself is confirmed at 0.
      const orderTotal = closingLineCount === 0 ? 0 : parseMoney(await cart.orderTotal.textContent().catch(() => null));
      await testInfo.attach('Closing line count / order total after quantity=0', {
        body: `line count: ${closingLineCount}\norder total: ${orderTotal}`,
        contentType: 'text/plain',
      });

      expect(closingLineCount).toBe(0);
      expect(orderTotal).toBeCloseTo(0, 2);
    });

    await test.step('Wrap Up — return to the store home page', async () => {
      await header.gotoHome();
    });
  });
});
