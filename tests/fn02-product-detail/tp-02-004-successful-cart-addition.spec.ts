import { test, expect } from '@playwright/test';
import { HeaderBar } from '../../pages/HeaderBar';
import { CatalogPage } from '../../pages/CatalogPage';
import { ProductPage } from '../../pages/ProductPage';
import { CartPage } from '../../pages/CartPage';
import { PRODUCTS, PRODUCT_HANDLES } from '../../fixtures/test-data';
import { recordUrl, withFailureEvidence } from '../../utils/evidence';

/**
 * TP-02-004 — Verify a variant with a size selected and stock available
 * is added to the cart, and the page URL matches the product displayed.
 * Covers TC-02-004 (#1 to #5) — #5 added by the refined TPS FN-02,
 * checking URL correspondence for a second product.
 *
 * EXPECTED TO FAIL, BY DESIGN, on step #5 only — marked via test.fail()
 * below. Confirmed defect DEF-F2-02: "Black heels" shows the
 * flower-print-jeans handle in its URL (PRODUCT_HANDLES.blackHeels is
 * already 'flower-print-jeans' in fixtures/test-data.ts, capturing this
 * exact mismatch). Steps #1-4 (Noir Jacket) have no known defect and
 * stay hard-asserted; test.fail() applies to the whole test, so step
 * #5's failure is what determines the overall result even though #1-4
 * genuinely pass.
 *
 * Uses CartPage (a real navigation), not CartDrawer, for line counts —
 * CartDrawer's #drawer is a stale, server-rendered snapshot from page
 * load that does not reflect an add performed via AJAX on that same
 * page (confirmed during TP-02-003; see CartDrawer.ts).
 */
test.describe('FN-02 Product Detail', () => {
  test('TP-02-004 successful cart addition and URL correspondence', async ({ page }, testInfo) => {
    test.fail(true, 'Confirmed defect DEF-F2-02: Black Heels shows the flower-print-jeans handle in its URL.');

    const header = new HeaderBar(page);
    const catalog = new CatalogPage(page);
    const product = new ProductPage(page);
    const cart = new CartPage(page);

    let baselineLineCount = 0;

    await withFailureEvidence(page, testInfo, async () => {
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

    await test.step('TC-02-004 #1 — open Noir jacket, check variant controls', async () => {
      await catalog.goto();
      await catalog.productLink(PRODUCTS.noirJacket).click();

      const [name, price, description] = await Promise.all([
        product.title.textContent(),
        product.price.textContent(),
        product.description.textContent(),
      ]);
      await testInfo.attach('Product name / price / description', {
        body: `name: ${name?.trim()}\nprice: ${price?.trim()}\ndescription: ${description?.trim()}`,
        contentType: 'text/plain',
      });

      const [addToCartEnabled, soldOutBadgeCount] = await Promise.all([
        product.addToCartButton.isEnabled(),
        page.locator('.sold-out').count(),
      ]);
      await testInfo.attach('Add to Cart control state / Sold Out badge', {
        body: `Add to Cart enabled: ${addToCartEnabled}\nSold Out badge present: ${soldOutBadgeCount > 0}`,
        contentType: 'text/plain',
      });
      await testInfo.attach('Add to Cart control — screenshot', {
        body: await product.addToCartButton.screenshot(),
        contentType: 'image/png',
      });

      expect(addToCartEnabled).toBe(true);
      expect(soldOutBadgeCount).toBe(0);
    });

    await test.step('TC-02-004 #2 — record the page URL', async () => {
      const url = await recordUrl(page, testInfo, 'Noir jacket PDP');
      expect(url).toContain(PRODUCT_HANDLES.noirJacket);
    });

    await test.step('TC-02-004 #3 — select size M, colour Blue', async () => {
      await product.selectSize('M');
      await product.selectColour('Blue');

      await expect(product.sizeSelect).toHaveValue('M');
      await expect(product.colourSelect).toHaveValue('Blue');
      await testInfo.attach('Variant selections', {
        body: 'size: M\ncolour: Blue',
        contentType: 'text/plain',
      });
    });

    await test.step('TC-02-004 #4 — Add to Cart, verify line and no inline message', async () => {
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
      expect(lineDescription).toContain('M');
      expect(lineDescription).toContain('Blue');
    });

    await test.step('TC-02-004 #5 — Black Heels URL correspondence (DEF-F2-02)', async () => {
      await header.gotoHome();
      await catalog.goto();
      await catalog.productLink(PRODUCTS.blackHeels).click();

      const name = await product.title.textContent();
      const url = await recordUrl(page, testInfo, 'Black Heels PDP');
      await testInfo.attach('Black Heels — product name / URL', {
        body: `name: ${name?.trim()}\nurl: ${url}\nactual handle in URL (confirmed buggy, DEF-F2-02): ${PRODUCT_HANDLES.blackHeels}`,
        contentType: 'text/plain',
      });

      // Expected to fail — DEF-F2-02: the URL carries the
      // flower-print-jeans handle (PRODUCT_HANDLES.blackHeels — the
      // confirmed ACTUAL, buggy value) instead of one corresponding to
      // "Black heels", so the assertion checks against the handle a
      // correct URL should have, not the already-buggy constant.
      expect.soft(url, 'TC-02-004 #5 expects the URL to correspond to the product displayed.').toContain('black-heels');
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
});
