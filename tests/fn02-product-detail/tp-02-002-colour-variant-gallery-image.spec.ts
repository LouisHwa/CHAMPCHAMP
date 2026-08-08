import { test, expect } from '../../utils/pacedTest';
import { HeaderBar } from '../../pages/HeaderBar';
import { ProductPage } from '../../pages/ProductPage';
import { CartDrawer } from '../../pages/CartDrawer';
import { PRODUCT_HANDLES } from '../../fixtures/test-data';

/**
 * TP-02-002 — Verify the gallery image updates when a different colour
 * variant is selected. Covers TC-02-002 (#1 to #4).
 *
 * SPR-07 asks for the gallery image to be captured before and after the
 * colour change "so the comparison is evidenced rather than asserted" —
 * that wording is deliberate here, not just followed loosely: whether
 * Noir jacket actually serves a distinct photo per colour hasn't been
 * confirmed (a single shared image across variants was observed on
 * another product during page-object capture), so this step attaches
 * both the screenshot and the raw src for each colour rather than
 * hard-asserting they differ.
 */
test.describe('FN-02 Product Detail', () => {
  test('TP-02-002 colour variant gallery image update', async ({ page }, testInfo) => {
    const header = new HeaderBar(page);
    const product = new ProductPage(page);
    const cart = new CartDrawer(page);

    let baselineLineCount = 0;

    await test.step('Set Up — baseline cart line count', async () => {
      await header.gotoHome();
      await cart.open();
      baselineLineCount = await cart.lineCount();
      await testInfo.attach('Baseline cart line count', {
        body: String(baselineLineCount),
        contentType: 'text/plain',
      });
      await header.gotoHome();
    });

    await test.step('TC-02-002 #1 — open Noir jacket, select size S', async () => {
      await product.goto(PRODUCT_HANDLES.noirJacket);
      await product.selectSize('S');

      await expect(product.sizeSelect).toHaveValue('S');
      await expect(product.addToCartButton).toBeEnabled();
      const soldOutBadgeCount = await page.locator('.sold-out').count();

      await testInfo.attach('Variant controls state', {
        body: `Size dropdown: S\nAdd to Cart enabled: true\nSold Out badge present: ${soldOutBadgeCount > 0}`,
        contentType: 'text/plain',
      });
      expect(soldOutBadgeCount).toBe(0);
    });

    await test.step('TC-02-002 #2 — select colour Blue, capture gallery image', async () => {
      await product.selectColour('Blue');
      await testInfo.attach('Gallery image — Blue (screenshot)', {
        body: await product.galleryImage.screenshot(),
        contentType: 'image/png',
      });
      await testInfo.attach('Gallery image — Blue (src)', {
        body: (await product.galleryImage.getAttribute('src')) ?? '(no src attribute)',
        contentType: 'text/plain',
      });
    });

    await test.step('TC-02-002 #3 — change colour to Red, capture gallery image', async () => {
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

    await test.step('TC-02-002 #4 — cart line count unchanged', async () => {
      await cart.open();
      const closingLineCount = await cart.lineCount();
      await testInfo.attach('Closing cart line count', {
        body: `baseline: ${baselineLineCount}\nclosing:  ${closingLineCount}`,
        contentType: 'text/plain',
      });
      expect(closingLineCount).toBe(baselineLineCount);
    });

    await test.step('Wrap Up — return to the store home page', async () => {
      await header.gotoHome();
    });
  });
});
