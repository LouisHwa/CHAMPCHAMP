import { test, expect } from '@playwright/test';
import { HeaderBar } from '../../pages/HeaderBar';
import { ProductPage } from '../../pages/ProductPage';
import { CartPage } from '../../pages/CartPage';
import { PRODUCT_HANDLES } from '../../fixtures/test-data';
import { parseMoney } from '../../utils/evidence';

/**
 * TP-04-008 — Verify a cart line is removed while other lines remain,
 * and the order total recalculates. Covers TC-04-008 (#1 to #2). No
 * known defect against this procedure — expected to pass.
 */
test.describe('FN-04 Cart Management', () => {
  test('TP-04-008 cart line removal', async ({ page }, testInfo) => {
    const header = new HeaderBar(page);
    const product = new ProductPage(page);
    const cart = new CartPage(page);

    await test.step('Set Up — confirm empty cart baseline', async () => {
      await cart.goto();
      expect(await cart.lineCount()).toBe(0);
      await header.gotoHome();
    });

    await test.step('TC-04-008 #1 — add Grey Jacket and Bronze sandals, record line/order totals', async () => {
      for (const handle of [PRODUCT_HANDLES.greyJacket, PRODUCT_HANDLES.bronzeSandals]) {
        await product.goto(handle);
        const resp = page.waitForResponse((r) => r.url().includes('/cart/add'), { timeout: 10_000 }).catch(() => null);
        await product.addToCartButton.click();
        await resp;
      }

      await cart.goto();
      expect(await cart.lineCount()).toBe(2);

      const lineTotal1 = parseMoney(await cart.lineTotal(0).textContent());
      const lineTotal2 = parseMoney(await cart.lineTotal(1).textContent());
      const orderTotal = parseMoney(await cart.orderTotal.textContent());
      await testInfo.attach('Initial line totals / order total', {
        body: `line 1: ${lineTotal1}\nline 2: ${lineTotal2}\norder total: ${orderTotal}`,
        contentType: 'text/plain',
      });
      expect(orderTotal).toBeCloseTo(lineTotal1 + lineTotal2, 2);
    });

    await test.step('TC-04-008 #2 — remove line 1, line 2 survives, order total recalculates', async () => {
      const lineTotal2Before = parseMoney(await cart.lineTotal(1).textContent());
      await cart.removeLine(0).click();
      await cart.goto();

      const closingLineCount = await cart.lineCount();
      const remainingDescription = closingLineCount > 0 ? await cart.lineDescription(0).textContent() : null;
      const remainingTotal = closingLineCount > 0 ? parseMoney(await cart.lineTotal(0).textContent()) : NaN;
      const orderTotal = parseMoney(await cart.orderTotal.textContent());
      await testInfo.attach('After removing line 1', {
        body: `remaining line count: ${closingLineCount}\nremaining line: ${remainingDescription?.trim()}\nremaining line total: ${remainingTotal}\norder total: ${orderTotal}`,
        contentType: 'text/plain',
      });

      expect(closingLineCount).toBe(1);
      expect(remainingTotal).toBeCloseTo(lineTotal2Before, 2);
      expect(orderTotal).toBeCloseTo(lineTotal2Before, 2);
    });

    await test.step('Wrap Up — remove remaining line, return to baseline', async () => {
      await cart.removeLine(0).click();
      await cart.goto();
      expect(await cart.lineCount()).toBe(0);
      await header.gotoHome();
    });
  });
});
