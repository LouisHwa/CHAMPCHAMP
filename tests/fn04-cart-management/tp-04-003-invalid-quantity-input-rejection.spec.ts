import { test, expect } from '@playwright/test';
import { HeaderBar } from '../../pages/HeaderBar';
import { ProductPage } from '../../pages/ProductPage';
import { CartPage } from '../../pages/CartPage';
import { PRODUCT_HANDLES } from '../../fixtures/test-data';
import { withFailureEvidence } from '../../utils/evidence';

/**
 * TP-04-003 — Verify negative, non-numeric, fractional and empty quantity
 * input is rejected with an explicit validation error. Covers TC-04-003
 * (#1 to #5).
 *
 * EXPECTED TO FAIL, BY DESIGN — marked via test.fail() below. Confirmed
 * in the team's Defect Log (DEF-F4-03): the quantity field silently
 * reverts to the previous value for any input that is not a positive
 * integer, with NO validation message shown at all. That directly
 * contradicts this TC's expected outcome. Every invalid value is still
 * exercised (via expect.soft) so all four attempts are recorded as
 * evidence, not just the first failure.
 *
 * The whole body is wrapped in withFailureEvidence: test.fail() reports
 * an expected failure as "passed", so Playwright's own automatic
 * screenshot/trace/video capture never fires — if something unrelated
 * to DEF-F4-03 breaks first (confirmed to happen: a Cloudflare
 * interstitial mid-run), this is what leaves evidence behind instead of
 * a silent false pass with nothing to show for it.
 *
 * Intercase dependency: TP-04-001's valid quantity acceptance step.
 */
test.describe('FN-04 Cart Management', () => {
  test('TP-04-003 invalid quantity input rejection', async ({ page }, testInfo) => {
    test.fail(true, 'Confirmed defect DEF-F4-03: invalid quantity silently reverts, no validation message is ever shown.');

    const header = new HeaderBar(page);
    const product = new ProductPage(page);
    const cart = new CartPage(page);

    await withFailureEvidence(page, testInfo, async () => {
      await test.step('Set Up — confirm empty cart baseline', async () => {
        await cart.goto();
        expect(await cart.lineCount()).toBe(0);
        await header.gotoHome();
      });

      await test.step('TC-04-003 #1 — establish baseline quantity 2', async () => {
        await product.goto(PRODUCT_HANDLES.bronzeSandals);
        const cartAddResponse = page
          .waitForResponse((res) => res.url().includes('/cart/add'), { timeout: 10_000 })
          .catch(() => null);
        await product.addToCartButton.click();
        await cartAddResponse;

        await cart.goto();
        await cart.lineQuantityInput(0).fill('2');
        await cart.updateButton.click();
        await cart.goto();
        expect(await cart.lineQuantityInput(0).inputValue()).toBe('2');
      });

      const invalidValues: { label: string; value: string; step: string }[] = [
        { label: 'negative (-5)', value: '-5', step: 'TC-04-003 #2' },
        { label: 'non-numeric (abc)', value: 'abc', step: 'TC-04-003 #3' },
        { label: 'fractional (2.5)', value: '2.5', step: 'TC-04-003 #4' },
        { label: 'empty', value: '', step: 'TC-04-003 #5' },
      ];

      for (const invalid of invalidValues) {
        await test.step(`${invalid.step} — quantity "${invalid.value || '(empty)'}"`, async () => {
          await cart.lineQuantityInput(0).fill(invalid.value);
          await cart.updateButton.click();
          await cart.goto();

          const messageLocator = page.locator('#cart .error, #cart .message, #cart [class*="error"]');
          const messageShown = (await messageLocator.count()) > 0;
          const quantityAfter = await cart.lineQuantityInput(0).inputValue();

          await testInfo.attach(`Quantity "${invalid.value || '(empty)'}" — system response`, {
            body: `explicit validation message shown: ${messageShown}\nquantity field value after commit: ${quantityAfter} (baseline was 2)`,
            contentType: 'text/plain',
          });

          expect.soft(messageShown, `TC-04-003 expects an explicit validation message for ${invalid.label} input.`).toBe(true);
        });
      }

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
