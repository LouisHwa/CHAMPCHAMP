import { test, expect } from '../../utils/pacedTest';
import { HeaderBar } from '../../pages/HeaderBar';
import { ProductPage } from '../../pages/ProductPage';
import { CartDrawer } from '../../pages/CartDrawer';
import { PRODUCT_HANDLES } from '../../fixtures/test-data';
import { recordUrl } from '../../utils/evidence';

/**
 * TP-02-002 — Verify the gallery image updates when a different colour
 * variant is selected. Covers TC-02-002 (#1 to #4).
 *
 * EXPECTED TO FAIL — DEF-F2-01. The gallery image does not update when
 * the colour variant changes: this store serves the same file for every
 * colour of TD-02-B. Confirmed from 18 recorded src values across 9 runs
 * between 6 and 9 August, every one of them
 * //sauce-demo.myshopify.com/cdn/shop/products/jacket.jpg?v=1394657254
 * for both TD-02-F (Blue) and TD-02-G (Red).
 *
 * The failure IS the finding. Per the TDS methodology — "a coverage item
 * that exposes a known defect is recorded as a failure, not silently
 * passed" — this procedure reports FAILED rather than being marked
 * test.fail(). test.fail() makes Playwright print "passed" for a test
 * whose assertion failed, which would misstate the result in a
 * verification report and, because Playwright then does not consider the
 * test failed, also suppresses the screenshot/trace/video that
 * retain-on-failure would otherwise keep. The defect is identified by the
 * annotation below so a reader can tell this apart from a regression.
 *
 * SPR-07 asks for the image to be captured before and after the change
 * "so the comparison is evidenced rather than asserted". Both screenshots
 * and both raw srcs are still attached, and the comparison verdict is
 * attached alongside them — previously the two srcs went into separate
 * attachments with nothing comparing them, so the defect sat unreported
 * in the evidence for three days while the test showed green.
 */
test.describe('FN-02 Product Detail', () => {
  test('TP-02-002 colour variant gallery image update', async ({ page }, testInfo) => {
    const header = new HeaderBar(page);
    const product = new ProductPage(page);
    const cart = new CartDrawer(page);

    testInfo.annotations.push({
      type: 'known defect',
      description:
        'DEF-F2-01 — the gallery image does not update when the colour variant changes. ' +
        'This procedure is expected to FAIL against the current store; the failure is the ' +
        'recorded finding, not a broken test. If it starts passing, the store has changed.',
    });

    let baselineLineCount = 0;
    let blueSrc = '';
    let redSrc = '';

    await test.step('Set Up — confirm empty cart, baseline line count', async () => {
      await header.gotoHome();
      // CartDrawer is safe in this procedure specifically: nothing is ever
      // added to the cart here, so the drawer's stale server-rendered
      // snapshot cannot lag behind an AJAX add. Do not copy this into a
      // spec that adds to the cart — use CartPage there (see CartDrawer.ts).
      await cart.open();
      baselineLineCount = await cart.lineCount();
      await testInfo.attach('Baseline cart line count (expected 0, per ENV-08)', {
        body: String(baselineLineCount),
        contentType: 'text/plain',
      });
      // The TPS Set Up requires the cart to be CONFIRMED empty, not merely
      // recorded — ENV-08 is a precondition, so a non-empty cart invalidates
      // the run rather than just shifting the baseline.
      expect(baselineLineCount).toBe(0);
      await header.gotoHome();
    });

    await test.step('TC-02-002 #1 — open Noir jacket, select size S', async () => {
      await product.goto(PRODUCT_HANDLES.noirJacket);
      await recordUrl(page, testInfo, 'Noir jacket PDP');
      await product.selectSize('S');

      await expect(product.sizeSelect).toHaveValue('S');
      await expect(product.addToCartButton).toBeEnabled();
      const soldOutBadgeCount = await page.locator('.sold-out').count();

      // Read the values back rather than restating them: SPR-07 asks for
      // this procedure's evidence to be observed, not asserted, and a
      // hardcoded "Add to Cart enabled: true" in the report is the latter.
      const [sizeShown, addToCartEnabled, sizeOptions, colourOptions] = await Promise.all([
        product.sizeSelect.inputValue(),
        product.addToCartButton.isEnabled(),
        product.sizeSelect.locator('option').allTextContents(),
        product.colourSelect.locator('option').allTextContents(),
      ]);

      await testInfo.attach('Variant controls state', {
        body:
          `Size dropdown: ${sizeShown}\n` +
          `Add to Cart enabled: ${addToCartEnabled}\n` +
          `Sold Out badge present: ${soldOutBadgeCount > 0}\n` +
          `Available sizes: ${sizeOptions.join(', ')}\n` +
          `Available colours: ${colourOptions.join(', ')}`,
        contentType: 'text/plain',
      });
      expect(soldOutBadgeCount).toBe(0);
    });

    await test.step('TC-02-002 #2 — select colour Blue, capture gallery image', async () => {
      await product.selectColour('Blue');
      blueSrc = (await product.galleryImage.getAttribute('src')) ?? '(no src attribute)';
      await testInfo.attach('Gallery image — Blue (screenshot)', {
        body: await product.galleryImage.screenshot(),
        contentType: 'image/png',
      });
      await testInfo.attach('Gallery image — Blue (src)', {
        body: blueSrc,
        contentType: 'text/plain',
      });
    });

    await test.step('TC-02-002 #3 — change colour to Red, capture gallery image', async () => {
      await product.selectColour('Red');
      redSrc = (await product.galleryImage.getAttribute('src')) ?? '(no src attribute)';
      await testInfo.attach('Gallery image — Red (screenshot)', {
        body: await product.galleryImage.screenshot(),
        contentType: 'image/png',
      });
      await testInfo.attach('Gallery image — Red (src)', {
        body: redSrc,
        contentType: 'text/plain',
      });

      // TPS Set Up #5 captures this image "for comparison with the image
      // captured at Step 4". That comparison is made here rather than left
      // to whoever reads the report: with the two srcs in separate
      // attachments and nothing comparing them, it went unmade across all
      // 9 recorded runs.
      const changed = redSrc !== blueSrc;
      await testInfo.attach('Gallery image comparison (TC-02-002 #3)', {
        body:
          `Blue (TD-02-F): ${blueSrc}\n` +
          `Red  (TD-02-G): ${redSrc}\n` +
          `gallery image changed: ${changed ? 'yes' : 'no'}\n`,
        contentType: 'text/plain',
      });

      // Soft, so TC-02-002 #4's cart-line-count evidence is still collected
      // and the Wrap Up still runs. The test still reports FAILED overall.
      expect
        .soft(
          redSrc,
          'TC-02-002 expects the gallery image to update when the colour variant changes. ' +
            'DEF-F2-01: the same image is served for every colour of TD-02-B, so it never ' +
            'updates.',
        )
        .not.toBe(blueSrc);
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
