import { test, expect } from '@playwright/test';
import { HeaderBar } from '../../pages/HeaderBar';
import { ProductPage } from '../../pages/ProductPage';
import { CartPage } from '../../pages/CartPage';
import { PRODUCT_HANDLES, ROUTES } from '../../fixtures/test-data';
import { parseMoney, recordUrl } from '../../utils/evidence';

/**
 * TP-04-010 — Verify Continue Shopping returns the shopper to the
 * catalogue with the cart contents unchanged. Covers TC-04-010 (#1 to
 * #3). No known defect against this procedure — expected to pass.
 */
test.describe('FN-04 Cart Management', () => {
  test('TP-04-010 Continue Shopping', async ({ page }, testInfo) => {
    const header = new HeaderBar(page);
    const product = new ProductPage(page);
    const cart = new CartPage(page);

    await test.step('Set Up — confirm empty cart baseline', async () => {
      await cart.goto();
      expect(await cart.lineCount()).toBe(0);
      await header.gotoHome();
    });

    let initialLineCount = 0;
    let initialOrderTotal = 0;

    await test.step('TC-04-010 #1 — add a product, record cart lines and order total', async () => {
      await product.goto(PRODUCT_HANDLES.bronzeSandals);
      const resp = page.waitForResponse((r) => r.url().includes('/cart/add'), { timeout: 10_000 }).catch(() => null);
      await product.addToCartButton.click();
      await resp;

      await cart.goto();
      initialLineCount = await cart.lineCount();
      initialOrderTotal = parseMoney(await cart.orderTotal.textContent());
      await testInfo.attach('Initial cart lines / order total', {
        body: `line count: ${initialLineCount}\norder total: ${initialOrderTotal}`,
        contentType: 'text/plain',
      });
    });

    await test.step('TC-04-010 #2 — click Continue Shopping', async () => {
      await cart.continueShoppingLink.click();
      const destination = await recordUrl(page, testInfo, 'Continue Shopping');
      expect(destination).toContain(ROUTES.catalog);
    });

    await test.step('TC-04-010 #3 — reopen cart, compare with initial values', async () => {
      await cart.goto();
      const closingLineCount = await cart.lineCount();
      const closingOrderTotal = parseMoney(await cart.orderTotal.textContent());
      await testInfo.attach('Reopened cart lines / order total', {
        body: `line count: ${closingLineCount} (was ${initialLineCount})\norder total: ${closingOrderTotal} (was ${initialOrderTotal})`,
        contentType: 'text/plain',
      });

      expect(closingLineCount).toBe(initialLineCount);
      expect(closingOrderTotal).toBeCloseTo(initialOrderTotal, 2);
    });

    await test.step('Wrap Up — empty the cart, return to the store home page', async () => {
      const remaining = await cart.lineCount();
      for (let i = remaining - 1; i >= 0; i--) {
        await cart.removeLine(i).click();
      }
      await header.gotoHome();
    });
  });
});
