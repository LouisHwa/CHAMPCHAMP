import { test, expect } from '../../utils/pacedTest';
import { HeaderBar } from '../../pages/HeaderBar';
import { ProductPage } from '../../pages/ProductPage';
import { CartPage } from '../../pages/CartPage';
import { PRODUCT_HANDLES } from '../../fixtures/test-data';
import { parseMoney } from '../../utils/evidence';

/**
 * TP-04-001 — Verify a valid positive integer quantity, within available
 * stock, is accepted and the cart totals are recalculated correctly.
 * Covers TC-04-001 (#1 to #3). No known defect against this procedure —
 * expected to pass.
 */
test.describe('FN-04 Cart Management', () => {
  test('TP-04-001 valid positive integer quantity and total recalculation', async ({ page }, testInfo) => {
    const header = new HeaderBar(page);
    const product = new ProductPage(page);
    const cart = new CartPage(page);

    await test.step('Set Up — confirm empty cart baseline', async () => {
      await cart.goto();
      expect(await cart.lineCount()).toBe(0);
      await header.gotoHome();
    });

    let unitPrice = 0;

    await test.step('TC-04-001 #1 — add an in-stock product to the cart', async () => {
      await product.goto(PRODUCT_HANDLES.bronzeSandals);
      unitPrice = parseMoney(await product.price.textContent());
      const cartAddResponse = page
        .waitForResponse((res) => res.url().includes('/cart/add'), { timeout: 10_000 })
        .catch(() => null);
      await product.addToCartButton.click();
      await cartAddResponse;
    });

    await test.step('TC-04-001 #2 — commit quantity 1', async () => {
      await cart.goto();
      await cart.lineQuantityInput(0).fill('1');
      await cart.updateButton.click();
      await cart.goto();

      const committedQty = await cart.lineQuantityInput(0).inputValue();
      const lineTotal = parseMoney(await cart.lineTotal(0).textContent());
      const orderTotal = parseMoney(await cart.orderTotal.textContent());
      await testInfo.attach('Quantity 1 — committed qty / line total / order total', {
        body: `qty: ${committedQty}\nunit price: ${unitPrice}\nline total: ${lineTotal}\norder total: ${orderTotal}`,
        contentType: 'text/plain',
      });

      expect(committedQty).toBe('1');
      expect(lineTotal).toBeCloseTo(1 * unitPrice, 2);
      expect(orderTotal).toBeCloseTo(lineTotal, 2);
    });

    await test.step('TC-04-001 #3 — commit quantity 3, without removing the product', async () => {
      await cart.lineQuantityInput(0).fill('3');
      await cart.updateButton.click();
      await cart.goto();

      const committedQty = await cart.lineQuantityInput(0).inputValue();
      const lineTotal = parseMoney(await cart.lineTotal(0).textContent());
      const orderTotal = parseMoney(await cart.orderTotal.textContent());
      await testInfo.attach('Quantity 3 — committed qty / line total / order total', {
        body: `qty: ${committedQty}\nunit price: ${unitPrice}\nline total: ${lineTotal}\norder total: ${orderTotal}`,
        contentType: 'text/plain',
      });

      expect(committedQty).toBe('3');
      expect(lineTotal).toBeCloseTo(3 * unitPrice, 2);
      expect(orderTotal).toBeCloseTo(lineTotal, 2);
    });

    await test.step('Wrap Up — remove the product, confirm baseline', async () => {
      await cart.removeLine(0).click();
      await cart.goto();
      expect(await cart.lineCount()).toBe(0);
      await header.gotoHome();
    });
  });
});
