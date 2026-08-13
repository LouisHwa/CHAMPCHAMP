import { test, expect } from '../../utils/pacedTest';
import { HeaderBar } from '../../pages/HeaderBar';
import { ProductPage } from '../../pages/ProductPage';
import { CartPage } from '../../pages/CartPage';
import { CART_TEST_DATA } from '../../fixtures/test-data';
import { parseMoney, withFailureEvidence } from '../../utils/evidence';

/**
 * TP-04-001 — Verify the cart line quantity field accepts a valid
 * positive integer at and above the minimum with totals recalculated,
 * removes the line when set to zero, and rejects negative, non-numeric,
 * fractional and empty input with an explicit validation error. Covers
 * TC-04-001, TC-04-002, TC-04-003 (merged into one procedure per the
 * refined TPS FN-04, which declares TC-04-002 and TC-04-003 both
 * intercase-dependent on TC-04-001).
 *
 * REPORTS AS A REAL FAILURE. test.fail() was removed by team decision on
 * 13 August: it made Playwright report an unmet expected result as
 * "passed", so the console count contradicted the Defect Log and any
 * unrelated breakage (a Cloudflare interstitial, a timeout) was hidden
 * behind the same green tick. The run now states the true number of
 * failures.
 *
 * Every expected-result check is expect.soft(), so a failure is recorded
 * and execution CONTINUES to the end of the procedure — one run surfaces
 * every unmet result rather than stopping at the first. Set Up and Reset
 * preconditions stay hard: if the cart is not empty when the procedure
 * starts, the run is invalid and continuing would only cascade noise.
 *
 * Expected failures here are the TC-04-003 section, confirming DEF-F4-03:
 * the quantity field silently reverts to the previous value for any input
 * that is not a positive integer, with NO validation message shown. The
 * TC-04-001/002 sections (valid quantity, zero-quantity removal) have no
 * known defect and are expected to pass.
 */
test.describe('FN-04 Cart Management', () => {
  test('TP-04-001 quantity entry validation', async ({ page }, testInfo) => {
    // This procedure merges what used to be three separate tests
    // (TC-04-001/002/003), and the default 30s timeout — already tight
    // with slowMo pacing added — cut it off mid-run, confirmed live.
    test.setTimeout(90_000);

    const header = new HeaderBar(page);
    const product = new ProductPage(page);
    const cart = new CartPage(page);

    await withFailureEvidence(page, testInfo, async () => {
      await test.step('Set Up — confirm empty cart baseline', async () => {
        await cart.goto();
        expect(await cart.lineCount()).toBe(0);
        await header.gotoHome();
      });

      await test.step('Set Up — stock quantity display on the PDP (evidence only)', async () => {
        // The TPS's own text carries this generic stock-display check
        // into TP-04-001's Set Up (tagged [TC-04-004 #1] there, which
        // matches TP-04-002's dedicated stock check verbatim) — recorded
        // here for completeness with the document as written, but this
        // procedure's actual TCs (001-003) don't otherwise depend on it.
        await product.goto(CART_TEST_DATA.productAHandle);
        const stockIndicator = page.locator('#buy').getByText(/\d+\s*(in stock|available|left)/i);
        const stockShown = await stockIndicator.isVisible().catch(() => false);
        await testInfo.attach('Stock quantity displayed on PDP', {
          body: `stock indicator visible: ${stockShown}`,
          contentType: 'text/plain',
        });
      });

      let unitPrice = 0;

      await test.step('TC-04-001 #1 — select TD-04-A, record unit price, add to cart, one line displayed', async () => {
        // Previously folded into Set Up and the top of #2, which left
        // TC-04-001 #1 with no step of its own in the report even though
        // the actions were performed. The refined TPS makes it a numbered
        // step: select the product, RECORD ITS UNIT PRICE, add it, open the
        // cart and confirm one line.
        unitPrice = parseMoney(await product.price.textContent());

        const cartAddResponse = page
          .waitForResponse((res) => res.url().includes('/cart/add'), { timeout: 10_000 })
          .catch(() => null);
        await product.addToCartButton.click();
        await cartAddResponse;

        await cart.goto();
        const lineCount = await cart.lineCount();
        const lineDescription = lineCount > 0 ? (await cart.lineDescription(0).textContent())?.trim() : null;

        await testInfo.attach('TC-04-001 #1 — product added, unit price recorded', {
          body:
            `product: ${CART_TEST_DATA.productA}\n` +
            `unit price recorded: ${unitPrice}\n` +
            `line count: ${lineCount}\n` +
            `line 0: ${lineDescription ?? '(no line)'}`,
          contentType: 'text/plain',
        });

        expect.soft(lineCount).toBe(1);
      });

      await test.step('TC-04-001 #2 — commit quantity 1', async () => {
        await cart.goto();
        await cart.lineQuantityInput(0).fill('1');
        await cart.updateButton.click();
        await cart.goto();

        const committedQty = await cart.lineQuantityInput(0).inputValue();
        const lineTotal = parseMoney(await cart.lineTotal(0).textContent());
        const orderTotal = parseMoney(await cart.orderTotal.textContent());
        await testInfo.attach('Quantity 1 — committed qty / line total / order total', {
          body: `qty: ${committedQty}\nunit price: ${unitPrice}\nline total: ${lineTotal}\norder total: ${orderTotal}`,
          contentType: 'text/plain',
        });

        expect.soft(committedQty).toBe('1');
        expect.soft(lineTotal).toBeCloseTo(1 * unitPrice, 2);
        expect.soft(orderTotal).toBeCloseTo(lineTotal, 2);
      });

      await test.step('TC-04-001 #3 — commit quantity 3, without removing the product', async () => {
        await cart.lineQuantityInput(0).fill('3');
        await cart.updateButton.click();
        await cart.goto();

        const committedQty = await cart.lineQuantityInput(0).inputValue();
        const lineTotal = parseMoney(await cart.lineTotal(0).textContent());
        const orderTotal = parseMoney(await cart.orderTotal.textContent());
        await testInfo.attach('Quantity 3 — committed qty / line total / order total', {
          body: `qty: ${committedQty}\nunit price: ${unitPrice}\nline total: ${lineTotal}\norder total: ${orderTotal}`,
          contentType: 'text/plain',
        });

        expect.soft(committedQty).toBe('3');
        expect.soft(lineTotal).toBeCloseTo(3 * unitPrice, 2);
        expect.soft(orderTotal).toBeCloseTo(lineTotal, 2);
      });

      await test.step('TC-04-002 #1 — remove, re-add the product, confirm one line displayed', async () => {
        await cart.removeLine(0).click();
        await cart.goto();
        expect(await cart.lineCount()).toBe(0);

        await product.goto(CART_TEST_DATA.productAHandle);
        const cartAddResponse = page
          .waitForResponse((res) => res.url().includes('/cart/add'), { timeout: 10_000 })
          .catch(() => null);
        await product.addToCartButton.click();
        await cartAddResponse;

        await cart.goto();
        const lineDisplayed = await cart.lineCount();
        const lineDescription = lineDisplayed > 0 ? await cart.lineDescription(0).textContent() : null;
        await testInfo.attach('Product line displayed after re-add', {
          body: `line count: ${lineDisplayed}\nline description: ${lineDescription?.trim() ?? '(none)'}`,
          contentType: 'text/plain',
        });
        expect.soft(lineDisplayed).toBe(1);
      });

      await test.step('TC-04-002 #2 — set quantity to 0, line removed, order total returns to nothing', async () => {
        await cart.lineQuantityInput(0).fill('0');
        await cart.updateButton.click();
        await cart.goto();

        const closingLineCount = await cart.lineCount();
        // An empty cart replaces the whole #cart section with a plain
        // "your cart is empty" message — .cart.total doesn't exist at
        // all in that state, so 0 is correct by definition once the
        // line count itself is confirmed at 0.
        const orderTotal = closingLineCount === 0 ? 0 : parseMoney(await cart.orderTotal.textContent().catch(() => null));
        await testInfo.attach('Closing line count / order total after quantity=0', {
          body: `line count: ${closingLineCount}\norder total: ${orderTotal}`,
          contentType: 'text/plain',
        });

        expect.soft(closingLineCount).toBe(0);
        expect.soft(orderTotal).toBeCloseTo(0, 2);
      });

      await test.step('TC-04-003 #1 — re-add the product, establish baseline quantity 2', async () => {
        await product.goto(CART_TEST_DATA.productAHandle);
        const cartAddResponse = page
          .waitForResponse((res) => res.url().includes('/cart/add'), { timeout: 10_000 })
          .catch(() => null);
        await product.addToCartButton.click();
        await cartAddResponse;

        await cart.goto();
        await cart.lineQuantityInput(0).fill('2');
        await cart.updateButton.click();
        await cart.goto();
        expect.soft(await cart.lineQuantityInput(0).inputValue()).toBe('2');
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
