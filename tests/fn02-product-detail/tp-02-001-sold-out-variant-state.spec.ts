import { test, expect } from '@playwright/test';
import { HeaderBar } from '../../pages/HeaderBar';
import { CatalogPage } from '../../pages/CatalogPage';
import { ProductPage } from '../../pages/ProductPage';
import { CartDrawer } from '../../pages/CartDrawer';
import { PRODUCTS, PRODUCT_HANDLES } from '../../fixtures/test-data';
import { recordUrl } from '../../utils/evidence';

/**
 * TP-02-001 — Verify a sold-out variant displays the Sold-Out state and
 * disables the Add to Cart control. Covers TC-02-001 (#1 to #3).
 *
 * Confirmed on a different sold-out product (Brown Shades, during page
 * object capture): this theme has NO separate visual "Sold Out" badge on
 * the product detail page — only the catalogue grid does. On the PDP,
 * #add itself changes value to "Sold Out" and gets disabled. That finding
 * is recorded here as the answer to TC-02-001 #1's badge question rather
 * than assumed silently, since it hasn't been directly confirmed for
 * White Sandals specifically.
 */
test.describe('FN-02 Product Detail', () => {
  test('TP-02-001 sold-out variant state', async ({ page }, testInfo) => {
    const header = new HeaderBar(page);
    const catalog = new CatalogPage(page);
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

    await test.step('TC-02-001 #1 — open White Sandals, check for a Sold Out badge', async () => {
      await catalog.goto();
      await catalog.productLink(PRODUCTS.whiteSandals).click();
      await recordUrl(page, testInfo, 'White Sandals PDP');
      await expect(page).toHaveURL(new RegExp(`/products/${PRODUCT_HANDLES.whiteSandals}`));

      const badgeCount = await page.locator('.sold-out').count();
      await testInfo.attach('Sold Out badge on PDP', {
        body: badgeCount > 0
          ? `${badgeCount} .sold-out element(s) found on the PDP.`
          : 'No .sold-out badge element found on the PDP (matches the pattern confirmed on Brown Shades — the theme signals sold-out state only through the Add to Cart control, not a separate badge here).',
        contentType: 'text/plain',
      });
      await testInfo.attach('Sold Out badge — screenshot', {
        body: await page.locator('#buy').screenshot(),
        contentType: 'image/png',
      });
    });

    await test.step('TC-02-001 #2 — Add to Cart control state', async () => {
      const disabled = await product.isAddToCartDisabled();
      const label = await product.addToCartLabel();
      await testInfo.attach('Add to Cart control state', {
        body: `disabled: ${disabled}\nlabel: ${label}`,
        contentType: 'text/plain',
      });
      await testInfo.attach('Add to Cart control — screenshot', {
        body: await product.addToCartButton.screenshot(),
        contentType: 'image/png',
      });
      expect(disabled).toBe(true);
    });

    await test.step('TC-02-001 #3 — cart line count unchanged', async () => {
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
