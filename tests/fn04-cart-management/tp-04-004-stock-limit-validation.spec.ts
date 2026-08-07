import { test, expect } from '@playwright/test';
import { HeaderBar } from '../../pages/HeaderBar';
import { ProductPage } from '../../pages/ProductPage';
import { CartPage } from '../../pages/CartPage';
import { PRODUCT_HANDLES } from '../../fixtures/test-data';
import { withFailureEvidence } from '../../utils/evidence';

/**
 * TP-04-004 — Verify quantity is validated against available stock, at
 * and either side of the stock limit. Covers TC-04-004 (#1 to #4).
 *
 * EXPECTED TO FAIL, BY DESIGN — marked via test.fail() below. Confirmed
 * in the Defect Log (DEF-F4-05): no stock quantity is ever shown on
 * product pages, and the store accepts any quantity with no inventory
 * limit at all. TC-04-004's own premise (recording a stock value S, then
 * testing S and S+1) is unreachable since there is no S to record — this
 * adapts the procedure to prove that absence directly, then demonstrates
 * that large representative quantities (51, 999) are accepted with no
 * refusal message, since there is no real S+1 boundary to test against.
 *
 * The whole body is wrapped in withFailureEvidence — see TP-04-003 for
 * why: test.fail() suppresses Playwright's automatic failure capture, so
 * this is what leaves evidence behind if something unrelated breaks the
 * test instead of DEF-F4-05 itself.
 *
 * Intercase dependency: TP-04-001's valid quantity acceptance step.
 */
test.describe('FN-04 Cart Management', () => {
  test('TP-04-004 stock limit validation', async ({ page }, testInfo) => {
    test.fail(true, 'Confirmed defect DEF-F4-05: no stock count is displayed, and no quantity is ever refused.');

    const header = new HeaderBar(page);
    const product = new ProductPage(page);
    const cart = new CartPage(page);

    await withFailureEvidence(page, testInfo, async () => {
      await test.step('Set Up — confirm empty cart baseline', async () => {
        await cart.goto();
        expect(await cart.lineCount()).toBe(0);
        await header.gotoHome();
      });

      await test.step('TC-04-004 #1 — look for a displayed stock quantity on the PDP', async () => {
        await product.goto(PRODUCT_HANDLES.bronzeSandals);
        const stockIndicator = page.locator('#buy').getByText(/\d+\s*(in stock|available|left)/i);
        const stockShown = await stockIndicator.isVisible().catch(() => false);
        await testInfo.attach('Stock quantity displayed on PDP', {
          body: `stock indicator visible: ${stockShown}`,
          contentType: 'text/plain',
        });
        // Soft, not hard: TC-04-004 #2/#3/#4 still need to run and attach
        // their own evidence even though this check is already known to
        // fail — a hard expect() here would abort the test before the
        // large-quantity checks ever get attempted.
        expect.soft(stockShown, 'TC-04-004 expects a stock quantity S to be displayed on the PDP.').toBe(true);
      });

      await test.step('TC-04-004 #2/#3/#4 — large representative quantities accepted without refusal', async () => {
        const cartAddResponse = page
          .waitForResponse((res) => res.url().includes('/cart/add'), { timeout: 10_000 })
          .catch(() => null);
        await product.addToCartButton.click();
        await cartAddResponse;
        await cart.goto();

        for (const qty of ['51', '999']) {
          await cart.lineQuantityInput(0).fill(qty);
          await cart.updateButton.click();
          await cart.goto();

          const refusalMessage = page.locator('#cart .error, #cart .message, #cart [class*="error"]');
          const refused = (await refusalMessage.count()) > 0;
          const committedQty = await cart.lineQuantityInput(0).inputValue();

          await testInfo.attach(`Quantity ${qty} — acceptance`, {
            body: `refusal message shown: ${refused}\nquantity field value after commit: ${committedQty}`,
            contentType: 'text/plain',
          });

          expect.soft(refused, `TC-04-004 expects quantity ${qty} to be refused as exceeding stock.`).toBe(true);
        }
      });

      await test.step('Wrap Up — remove the test product, return to baseline', async () => {
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
