import { test, expect } from '../../utils/pacedTest';
import { HeaderBar } from '../../pages/HeaderBar';
import { ProductPage } from '../../pages/ProductPage';
import { CartPage } from '../../pages/CartPage';
import { PRODUCT_HANDLES } from '../../fixtures/test-data';
import { recordUrl } from '../../utils/evidence';

/**
 * TP-02-005 — Verify a variant with a changed colour selection is added
 * to the cart with the correct (final) colour applied. Covers TC-02-005
 * (#1 to #3).
 *
 * Intercase dependency: TP-02-002 must have run (gallery image capture
 * on a colour change).
 *
 * EXPECTED TO PASS. This procedure's objective is that the CART receives
 * the final colour selection (TD-02-G), not that the gallery image
 * updates. The gallery captures required by SPR-07 are evidence only and
 * are deliberately NOT asserted here — DEF-F2-01 (the image never updates
 * on a colour change) is discharged by TP-02-002, which owns that
 * objective and fails on it. Asserting it here as well would fail this
 * procedure for a defect outside its scope. The captures below stand as
 * corroborating evidence for DEF-F2-01.
 *
 * Uses CartPage (a real navigation), not CartDrawer, for line counts —
 * CartDrawer's #drawer is a stale, server-rendered snapshot from page
 * load that does not reflect an add performed via AJAX on that same page
 * (confirmed during TP-02-003; see CartDrawer.ts).
 */
test.describe('FN-02 Product Detail', () => {
  test('TP-02-005 cart addition with changed colour selection', async ({ page }, testInfo) => {
    const header = new HeaderBar(page);
    const product = new ProductPage(page);
    const cart = new CartPage(page);

    let baselineLineCount = 0;

    await test.step('Set Up — confirm empty cart, baseline line count', async () => {
      await cart.goto();
      baselineLineCount = await cart.lineCount();
      await testInfo.attach('Baseline cart line count (expected 0, per ENV-08)', {
        body: String(baselineLineCount),
        contentType: 'text/plain',
      });
      expect(baselineLineCount).toBe(0);
      await header.gotoHome();
    });

    await test.step('TC-02-005 #1 — open Noir jacket, select size S', async () => {
      await product.goto(PRODUCT_HANDLES.noirJacket);
      await recordUrl(page, testInfo, 'Noir jacket PDP');
      await product.selectSize('S');

      const [addToCartEnabled, soldOutBadgeCount] = await Promise.all([
        product.addToCartButton.isEnabled(),
        page.locator('.sold-out').count(),
      ]);
      await testInfo.attach('Size dropdown / Add to Cart / Sold Out badge state', {
        body: `Size dropdown: S\nAdd to Cart enabled: ${addToCartEnabled}\nSold Out badge present: ${soldOutBadgeCount > 0}`,
        contentType: 'text/plain',
      });

      await expect(product.sizeSelect).toHaveValue('S');
      expect(addToCartEnabled).toBe(true);
      expect(soldOutBadgeCount).toBe(0);
    });

    await test.step('TC-02-005 #2 — select Blue, then change to Red, capture gallery both times', async () => {
      await product.selectColour('Blue');
      await testInfo.attach('Gallery image — Blue (screenshot)', {
        body: await product.galleryImage.screenshot(),
        contentType: 'image/png',
      });
      await testInfo.attach('Gallery image — Blue (src)', {
        body: (await product.galleryImage.getAttribute('src')) ?? '(no src attribute)',
        contentType: 'text/plain',
      });

      await product.selectColour('Red');
      await testInfo.attach('Gallery image — Red (screenshot)', {
        body: await product.galleryImage.screenshot(),
        contentType: 'image/png',
      });
      await testInfo.attach('Gallery image — Red (src)', {
        body: (await product.galleryImage.getAttribute('src')) ?? '(no src attribute)',
        contentType: 'text/plain',
      });
    });

    await test.step('TC-02-005 #3 — Add to Cart, verify final colour applied', async () => {
      const cartAddResponse = page
        .waitForResponse((res) => res.url().includes('/cart/add'), { timeout: 10_000 })
        .catch(() => null);
      await product.addToCartButton.click();
      await cartAddResponse;

      const possibleMessage = page.locator('#buy .error, #buy .message, #buy .alert, #buy [class*="error"]');
      const messageText = (await possibleMessage.count()) > 0 ? await possibleMessage.first().innerText() : null;
      await testInfo.attach('Inline size message', {
        body: messageText ?? 'none found (no element matching a generic error/message/alert pattern near the control)',
        contentType: 'text/plain',
      });

      await cart.goto();
      const closingLineCount = await cart.lineCount();
      const lineDescription = closingLineCount > 0 ? await cart.lineDescription(0).textContent() : null;
      await testInfo.attach('Closing cart line count and contents', {
        body: `baseline: ${baselineLineCount}\nclosing:  ${closingLineCount}\nline 0:   ${lineDescription?.trim() ?? '(no line)'}`,
        contentType: 'text/plain',
      });

      expect(closingLineCount).toBe(baselineLineCount + 1);
      expect(lineDescription).toContain('S');
      // The final colour selection (Red), not the intermediate one (Blue).
      expect(lineDescription).toContain('Red');
    });

    await test.step('Wrap Up — empty the cart, return to the store home page', async () => {
      const finalLineCount = await cart.lineCount();
      for (let i = finalLineCount - 1; i >= baselineLineCount; i--) {
        await cart.removeLine(i).click();
      }
      await header.gotoHome();
    });
  });
});
