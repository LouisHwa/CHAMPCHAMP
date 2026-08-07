import { test, expect } from '@playwright/test';
import { HeaderBar } from '../../pages/HeaderBar';
import { ProductPage } from '../../pages/ProductPage';
import { CartPage } from '../../pages/CartPage';
import { PRODUCT_HANDLES } from '../../fixtures/test-data';
import { recordUrl, withFailureEvidence } from '../../utils/evidence';

/**
 * TP-04-009 — Verify a cart line's product link opens the product detail
 * page with the correct variant selected. Covers TC-04-009 (#1 to #2).
 *
 * EXPECTED TO FAIL, BY DESIGN — marked via test.fail() below. Confirmed
 * in the Defect Log (DEF-F4-08): the cart line's product link opens the
 * product without the correct variant selected — it lands on the PDP's
 * usual auto-selected defaults (first Size/Colour option), not the
 * variant that was actually in the cart line.
 *
 * The whole body is wrapped in withFailureEvidence: test.fail() reports
 * an expected failure as "passed", so Playwright's own automatic
 * screenshot/trace/video capture never fires. CONFIRMED this matters in
 * practice — an earlier run of this exact test failed on a Cloudflare
 * interstitial mid-run (not DEF-F4-08 at all), was silently counted as
 * "passed" by test.fail(), and left zero evidence behind until manually
 * caught by inspecting the trace. This wrapper is what would have caught
 * that automatically instead.
 */
test.describe('FN-04 Cart Management', () => {
  test('TP-04-009 cart line product link', async ({ page }, testInfo) => {
    test.fail(true, 'Confirmed defect DEF-F4-08: the cart line product link does not pre-select the correct variant.');

    const header = new HeaderBar(page);
    const product = new ProductPage(page);
    const cart = new CartPage(page);

    await withFailureEvidence(page, testInfo, async () => {
      await test.step('Set Up — confirm empty cart baseline', async () => {
        await cart.goto();
        expect(await cart.lineCount()).toBe(0);
        await header.gotoHome();
      });

      await test.step('TC-04-009 #1 — add Noir jacket S/Red, record cart line variant', async () => {
        await product.goto(PRODUCT_HANDLES.noirJacket);
        await product.selectSize('S');
        await product.selectColour('Red');
        const resp = page.waitForResponse((r) => r.url().includes('/cart/add'), { timeout: 10_000 }).catch(() => null);
        await product.addToCartButton.click();
        await resp;

        await cart.goto();
        const description = (await cart.lineDescription(0).textContent()) ?? '';
        await testInfo.attach('Cart line variant', {
          body: description.trim(),
          contentType: 'text/plain',
        });
        expect(description).toContain('S');
        expect(description).toContain('Red');
      });

      await test.step('TC-04-009 #2 — follow the cart line product link, check pre-selected variant', async () => {
        await cart.lineProductLink(0).click();
        const destination = await recordUrl(page, testInfo, 'Cart line product link');

        const sizeValue = await product.sizeSelect.inputValue();
        const colourValue = await product.colourSelect.inputValue();
        await testInfo.attach('PDP variant dropdowns after following the cart line link', {
          body: `destination: ${destination}\nsize dropdown: ${sizeValue}\ncolour dropdown: ${colourValue}\nexpected: S / Red`,
          contentType: 'text/plain',
        });

        expect(sizeValue).toBe('S');
        expect(colourValue).toBe('Red');
      });

      await test.step('Wrap Up — empty the cart, return to the store home page', async () => {
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
