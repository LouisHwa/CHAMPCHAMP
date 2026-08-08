import { test, expect } from '../../utils/pacedTest';
import { HeaderBar } from '../../pages/HeaderBar';
import { ProductPage } from '../../pages/ProductPage';
import { CartPage } from '../../pages/CartPage';
import { PRODUCT_HANDLES } from '../../fixtures/test-data';

/**
 * TP-02-003 — Verify cart insertion is blocked with an inline validation
 * error when no size is selected. Covers TC-02-003 (#1 to #3).
 *
 * EXPECTED TO FAIL, BY DESIGN — marked via test.fail() below. This is not
 * a broken test: it checks the live site against what TC-02-003 says
 * should happen, and the site genuinely does not do that (see below).
 * test.fail() tells Playwright this test is known to fail, so CI stays
 * green while the underlying defect is unresolved, and only flips red if
 * the test unexpectedly PASSES — i.e. if the site's behaviour changes.
 * Do not remove test.fail() without confirming the underlying behaviour
 * has actually changed; removing it just to "fix" a red CI run defeats
 * the point.
 *
 * CONFIRMED via diagnostic run: this theme's inline script auto-selects
 * the first Size and Colour option on page load
 * (`$('.single-option-selector:eq(0)').val("S").trigger('change')`), and
 * clicking Add to Cart untouched genuinely succeeds — no inline error,
 * no block. "No size selected" is not a reachable state on this store.
 * That contradicts TC-02-003's expected outcome, so per the TDS's own
 * methodology ("a coverage item that exposes a known defect is recorded
 * as a failure, not silently passed"), this asserts the expected
 * behaviour and is allowed to fail rather than treating the mismatch as
 * ambiguous evidence. Cleanup (removing any line added at Step 4) runs
 * before that assertion so the cart is restored to baseline regardless
 * of whether the assertion passes.
 *
 * Uses CartPage (a real navigation), not CartDrawer, for both counts.
 * CartDrawer's #drawer is a server-rendered snapshot from page load and
 * does NOT reflect an add performed via AJAX on that same page — a
 * dependency also confirmed by diagnostic run (see CartDrawer.ts). Using
 * it here would silently show the pre-click count and produce a false
 * pass on exactly the behaviour this test exists to catch.
 */
test.describe('FN-02 Product Detail', () => {
  test('TP-02-003 missing size selection validation', async ({ page }, testInfo) => {
    test.fail(true, 'Confirmed defect: Size/Colour auto-select on load, so Add to Cart is never blocked. See file-level comment / DEF-F2-xx.');

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
    });

    await test.step('TC-02-003 #1 — Size dropdown value on load', async () => {
      await product.goto(PRODUCT_HANDLES.noirJacket);
      const sizeOnLoad = await product.sizeSelect.inputValue();
      await testInfo.attach('Size dropdown value on page load', {
        body: sizeOnLoad,
        contentType: 'text/plain',
      });
    });

    await test.step('TC-02-003 #2 — click Add to Cart without touching Size', async () => {
      const cartAddResponse = page
        .waitForResponse((res) => res.url().includes('/cart/add'), { timeout: 10_000 })
        .catch(() => null);
      await product.addToCartButton.click();
      const response = await cartAddResponse;

      const possibleMessage = page.locator('#buy .error, #buy .message, #buy .alert, #buy [class*="error"]');
      const messageText = (await possibleMessage.count()) > 0 ? await possibleMessage.first().innerText() : null;

      await testInfo.attach('System response after Add to Cart click', {
        body: `/cart/add response: ${response ? response.status() : 'not observed within 10s'}\n` +
          `inline message: ${messageText ?? 'none found (no element matching a generic error/message/alert pattern near the control)'}`,
        contentType: 'text/plain',
      });
      await testInfo.attach('System response — screenshot', {
        body: await page.locator('#buy').screenshot(),
        contentType: 'image/png',
      });
    });

    await test.step('TC-02-003 #3 — cart line count vs baseline', async () => {
      await cart.goto();
      const closingLineCount = await cart.lineCount();
      await testInfo.attach('Closing cart line count', {
        body: `baseline: ${baselineLineCount}\nclosing:  ${closingLineCount}`,
        contentType: 'text/plain',
      });

      // Restore baseline state before asserting, so cleanup happens
      // regardless of whether the assertion below passes or fails.
      for (let i = closingLineCount - 1; i >= baselineLineCount; i--) {
        await cart.removeLine(i).click();
      }

      // This assertion is expected to fail — see the file-level comment.
      expect(
        closingLineCount,
        'TC-02-003 expects Add to Cart to be blocked when no size is explicitly selected. ' +
          'Confirmed: this theme auto-selects Size="S"/Colour="Blue" on page load, so the ' +
          'click succeeds and a line is added instead. Candidate defect — needs a DEF-F2-xx ' +
          'entry in the defect log.',
      ).toBe(baselineLineCount);
    });

    await test.step('Wrap Up — return to the store home page', async () => {
      await header.gotoHome();
    });
  });
});
