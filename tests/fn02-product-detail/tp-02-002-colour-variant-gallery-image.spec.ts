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
 * BLOCKED IN FULL — A-013. DEF-F2-01 has been WITHDRAWN. The gallery
 * image never changes on a colour change, but not because the store is
 * faulty: no product in the catalogue carries a distinct gallery image
 * per colour variant. Every product holds a single image, so there is no
 * variant image for the gallery to change to and REQ-F2-03 was never
 * placed under test. That is store content configuration, not a fault,
 * and ENV-07 (as strengthened) is not satisfiable. TCOV-02-002's
 * condition cannot be established.
 *
 * WHAT THIS PROCEDURE ASSERTS, AND WHY IT IS NOT NOTHING. The block is
 * recorded as evidence AND monitored. The step below sweeps every colour
 * option and asserts the product exposes exactly ONE distinct gallery
 * image source. That asserts the ENVIRONMENT is still as A-013 describes
 * — it does not assert anything about REQ-F2-03. A-004 permits store
 * content to change without notice and we run against live production,
 * so if per-variant images are ever configured this goes red and flags
 * A-013 as stale and TC-02-002 as newly executable. A skipped test could
 * never do that, which is why this reports green rather than skipped.
 *
 * Two things must NEVER be asserted here:
 *   - that the image DOES change — it would fail for the wrong reason,
 *     reporting a defect where the requirement was never under test;
 *   - that the image does NOT change, as TC-02-002's expected result —
 *     that encodes observed behaviour as the oracle, which principle 1
 *     forbids. Expected results derive from the requirement, never from
 *     the site.
 *
 * The procedure is executed in full and nothing is deleted: SPR-07's
 * before/after screenshots and both raw srcs are still captured, and the
 * comparison is attached as an ENV-07 observation rather than a verdict
 * on the store.
 *
 * Preconditions stay hard-asserted — empty cart (ENV-08), Size = S, Add
 * to Cart enabled, no Sold Out badge, unchanged closing line count. Those
 * are preconditions and side effects, not the blocked condition.
 */
test.describe('FN-02 Product Detail', () => {
  test('TP-02-002 [BLOCKED A-013] Gallery image update on colour selection', async ({ page }, testInfo) => {
    const header = new HeaderBar(page);
    const product = new ProductPage(page);
    const cart = new CartDrawer(page);

    testInfo.annotations.push({
      type: 'blocked',
      description:
        'A-013: no colour variant carries an associated gallery image. ENV-07 not satisfiable. ' +
        'TCOV-02-002 condition cannot be established.',
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
      // captured at Step 4". The comparison is recorded here as an
      // observation, NOT as a verdict on the store — under A-013 the
      // requirement was never placed under test, so neither outcome of
      // this comparison can pass or fail TC-02-002.
      await testInfo.attach('Gallery image comparison (TC-02-002 #3)', {
        body:
          `Blue (TD-02-F): ${blueSrc}\n` +
          `Red  (TD-02-G): ${redSrc}\n` +
          `image source differs between the two colours: ${redSrc !== blueSrc ? 'yes' : 'no'}\n` +
          `\nRecorded as evidence only. See the A-013 block condition step below ` +
          `for the assertion that keeps this block honest.`,
        contentType: 'text/plain',
      });
    });

    await test.step('A-013 block condition — one gallery image across all colour options (ENV-07)', async () => {
      // Not a TC-02-002 step. This is the environment check that makes the
      // block demonstrable rather than assumed, and keeps it monitored.
      //
      // Sweeping EVERY colour option is deliberate: A-013's claim is that
      // no colour carries its own image, which a Blue-vs-Red comparison
      // only samples. Reading the source for each option and counting the
      // distinct set tests the claim as stated.
      const colourValues = await product.colourSelect
        .locator('option')
        .evaluateAll((options) =>
          options.map((o) => (o as HTMLOptionElement).value).filter((v) => v !== ''),
        );

      const sourceByColour: Record<string, string> = {};
      for (const colour of colourValues) {
        await product.selectColour(colour);
        sourceByColour[colour] = (await product.galleryImage.getAttribute('src')) ?? '(no src attribute)';
      }
      const distinctSources = new Set(Object.values(sourceByColour));

      await testInfo.attach('A-013 — gallery image source per colour option', {
        body:
          Object.entries(sourceByColour)
            .map(([colour, src]) => `${colour}: ${src}`)
            .join('\n') +
          `\n\ncolour options offered: ${colourValues.length}\n` +
          `distinct gallery image sources: ${distinctSources.size}\n` +
          `ENV-07 (each colour carries its own gallery image): ${distinctSources.size > 1 ? 'satisfied' : 'NOT satisfiable'}`,
        contentType: 'text/plain',
      });

      // Asserts the ENVIRONMENT, not the requirement. Going red here means
      // per-variant images now exist, so A-013 is stale and TC-02-002 has
      // become executable — exactly the change we need to be told about,
      // since A-004 lets store content change without notice.
      expect(
        distinctSources.size,
        'A-013 expects TD-02-B to expose a single gallery image across every colour option, ' +
          'which is why TC-02-002 is Blocked. If this fails the store now carries per-variant ' +
          'images: A-013 is stale, ENV-07 is satisfiable and TC-02-002 must be re-planned as ' +
          'executable. This does NOT assert REQ-F2-03 either way.',
      ).toBe(1);
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
