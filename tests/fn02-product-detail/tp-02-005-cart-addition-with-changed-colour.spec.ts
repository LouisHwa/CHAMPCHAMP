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
 * PARTIALLY BLOCKED — A-013. Step 2 is blocked; steps 1 and 3 are
 * executable and are the ones this procedure reports on.
 *
 * NO INTERCASE DEPENDENCY. The dependency this procedure used to declare
 * on TC-02-002 has been REMOVED: TC-02-002 is now Blocked in full under
 * A-013 and can never be discharged, and a dependency must not point at a
 * blocked case. (The TPS drops its Set Up 1 accordingly and renumbers the
 * remaining Set Up steps — document-side change.)
 *
 * DEF-F2-01 has been WITHDRAWN. No product in the catalogue carries a
 * distinct gallery image per colour variant, so there is no variant image
 * for the gallery to change to and REQ-F2-03 was never placed under test.
 * That is store content configuration recorded as A-013, not a fault.
 *
 * Step 2's gallery captures are therefore evidence only, exactly as SPR-07
 * asks, and nothing about the image is asserted here. The A-013 block
 * condition itself is asserted once, by TP-02-002, which owns that
 * environment check — repeating it here would duplicate the monitor
 * without adding coverage.
 *
 * What this procedure DOES assert is its own objective, which is
 * unaffected by A-013: that the cart line carries the LAST-selected
 * colour (TD-02-G, Red) and the selected size (TD-02-D, S) — not the
 * intermediate colour TD-02-F (Blue).
 *
 * Uses CartPage (a real navigation), not CartDrawer, for line counts —
 * CartDrawer's #drawer is a stale, server-rendered snapshot from page
 * load that does not reflect an add performed via AJAX on that same page
 * (confirmed during TP-02-003; see CartDrawer.ts).
 */
test.describe('FN-02 Product Detail', () => {
  test('TP-02-005 [PARTIAL A-013] Changed colour applied to cart', async ({ page }, testInfo) => {
    const header = new HeaderBar(page);
    const product = new ProductPage(page);
    const cart = new CartPage(page);

    testInfo.annotations.push({
      type: 'blocked',
      description:
        'A-013 (partial, step 2 only): no colour variant carries an associated gallery image, ' +
        'so ENV-07 is not satisfiable and TC-02-005 #2 cannot be evaluated. Steps 1 and 3 are ' +
        'executable and are asserted; the gallery captures are recorded as SPR-07 evidence only.',
    });

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

      // TC-02-005's own objective, unaffected by the A-013 block on step 2.
      expect(
        closingLineCount,
        'TC-02-005 #3 expects the variant to be appended to the cart.',
      ).toBe(baselineLineCount + 1);
      expect(
        lineDescription,
        'TC-02-005 #3 expects the cart line to carry the selected size TD-02-D (S).',
      ).toContain('S');
      // The LAST colour selected (TD-02-G, Red), not the intermediate
      // TD-02-F (Blue) — this is the whole point of the procedure.
      expect(
        lineDescription,
        'TC-02-005 #3 expects the cart line to carry the last-selected colour TD-02-G (Red), ' +
          'not the intermediate TD-02-F (Blue).',
      ).toContain('Red');
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
