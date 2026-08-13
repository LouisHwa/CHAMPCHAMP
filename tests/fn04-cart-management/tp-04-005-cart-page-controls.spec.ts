import { test, expect } from '../../utils/pacedTest';
import { HeaderBar } from '../../pages/HeaderBar';
import { ProductPage } from '../../pages/ProductPage';
import { CartPage } from '../../pages/CartPage';
import { CART_TEST_DATA, ROUTES } from '../../fixtures/test-data';
import { parseMoney, recordUrl, settleForEvidence, withFailureEvidence } from '../../utils/evidence';

/**
 * TP-04-005 — Verify a cart line is removed while other lines remain
 * with the order total recalculated, that a cart line product link
 * opens the product detail page with the correct variant selected, and
 * that Continue Shopping returns the shopper to the catalogue with the
 * cart contents unchanged. Covers TC-04-008, TC-04-009, TC-04-010
 * (merged per the refined TPS FN-04, replacing old TP-04-008/009/010).
 * The two-line scenario now uses TD-04-A/TD-04-B (Striped top / Grey
 * jacket) rather than Grey jacket/Bronze sandals.
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
 * Expected failure here is the TC-04-009 (product link) section,
 * confirming DEF-F4-08: the cart line's product link opens the product without
 * the correct variant selected, landing on the PDP's usual auto-selected
 * defaults instead. TC-04-008 (line removal) and TC-04-010 (Continue
 * Shopping) have no known defect and are expected to pass, so a correct
 * run reports failures only from the TC-04-009 section.
 *
 * Wrapped in withFailureEvidence so an unrelated breakage still leaves
 * a labelled screenshot and page text behind alongside Playwright's
 * own capture.
 */
test.describe('FN-04 Cart Management', () => {
  test('TP-04-005 cart page controls', async ({ page }, testInfo) => {
    const header = new HeaderBar(page);
    const product = new ProductPage(page);
    const cart = new CartPage(page);

    await withFailureEvidence(page, testInfo, async () => {
      await test.step('Set Up — confirm empty cart baseline', async () => {
        await cart.goto();
        expect(await cart.lineCount()).toBe(0);
        await header.gotoHome();
      });

      await test.step('TC-04-008 #1 — add Product A and Product B, record line/order totals', async () => {
        for (const handle of [CART_TEST_DATA.productAHandle, CART_TEST_DATA.productBHandle]) {
          await product.goto(handle);
          const resp = page.waitForResponse((r) => r.url().includes('/cart/add'), { timeout: 10_000 }).catch(() => null);
          await product.addToCartButton.click();
          await resp;
        }

        await cart.goto();
        expect.soft(await cart.lineCount()).toBe(2);

        const lineTotal1 = parseMoney(await cart.lineTotal(0).textContent());
        const lineTotal2 = parseMoney(await cart.lineTotal(1).textContent());
        const orderTotal = parseMoney(await cart.orderTotal.textContent());
        await testInfo.attach('Initial line totals / order total', {
          body: `line 1: ${lineTotal1}\nline 2: ${lineTotal2}\norder total: ${orderTotal}`,
          contentType: 'text/plain',
        });
        expect.soft(orderTotal).toBeCloseTo(lineTotal1 + lineTotal2, 2);
      });

      await test.step('TC-04-008 #2 — remove line 1, line 2 survives, order total recalculates', async () => {
        const lineTotal2Before = parseMoney(await cart.lineTotal(1).textContent());
        await cart.removeLine(0).click();
        await cart.goto();

        const closingLineCount = await cart.lineCount();
        const remainingDescription = closingLineCount > 0 ? await cart.lineDescription(0).textContent() : null;
        const remainingTotal = closingLineCount > 0 ? parseMoney(await cart.lineTotal(0).textContent()) : NaN;
        const orderTotal = parseMoney(await cart.orderTotal.textContent());
        await testInfo.attach('After removing line 1', {
          body: `remaining line count: ${closingLineCount}\nremaining line: ${remainingDescription?.trim()}\nremaining line total: ${remainingTotal}\norder total: ${orderTotal}`,
          contentType: 'text/plain',
        });

        expect.soft(closingLineCount).toBe(1);
        expect.soft(remainingTotal).toBeCloseTo(lineTotal2Before, 2);
        expect.soft(orderTotal).toBeCloseTo(lineTotal2Before, 2);
      });

      await test.step('Reset — empty the cart before the next test case', async () => {
        await cart.removeLine(0).click();
        await cart.goto();
        expect(await cart.lineCount()).toBe(0);
      });

      await test.step('TC-04-009 #1 — add TD-04-V (TD-04-V2), record cart line variant', async () => {
        await product.goto(CART_TEST_DATA.productVHandle);
        await product.selectSize(CART_TEST_DATA.variant2.size);
        await product.selectColour(CART_TEST_DATA.variant2.colour);
        const resp = page.waitForResponse((r) => r.url().includes('/cart/add'), { timeout: 10_000 }).catch(() => null);
        await product.addToCartButton.click();
        await resp;

        await cart.goto();
        const description = (await cart.lineDescription(0).textContent()) ?? '';
        await testInfo.attach('Cart line variant', {
          body: description.trim(),
          contentType: 'text/plain',
        });
        expect.soft(description).toContain(CART_TEST_DATA.variant2.size);
        expect.soft(description).toContain(CART_TEST_DATA.variant2.colour);
      });

      await test.step('TC-04-009 #2 — follow the cart line product link, check pre-selected variant', async () => {
        await cart.lineProductLink(0).click();
        const destination = await recordUrl(page, testInfo, 'Cart line product link');

        const sizeValue = await product.sizeSelect.inputValue();
        const colourValue = await product.colourSelect.inputValue();
        await testInfo.attach('PDP variant dropdowns after following the cart line link', {
          body: `destination: ${destination}\nsize dropdown: ${sizeValue}\ncolour dropdown: ${colourValue}\nexpected: ${CART_TEST_DATA.variant2.size} / ${CART_TEST_DATA.variant2.colour}`,
          contentType: 'text/plain',
        });

        expect.soft(sizeValue).toBe(CART_TEST_DATA.variant2.size);
        expect.soft(colourValue).toBe(CART_TEST_DATA.variant2.colour);
      });

      await test.step('Reset — empty the cart before the next test case', async () => {
        await cart.goto();
        const remaining = await cart.lineCount();
        for (let i = remaining - 1; i >= 0; i--) {
          await cart.removeLine(i).click();
        }
        await cart.goto();
        expect(await cart.lineCount()).toBe(0);
      });

      let initialLineCount = 0;
      let initialOrderTotal = 0;

      await test.step('TC-04-010 #1 — add Product A, record cart lines and order total', async () => {
        await product.goto(CART_TEST_DATA.productAHandle);
        const resp = page.waitForResponse((r) => r.url().includes('/cart/add'), { timeout: 10_000 }).catch(() => null);
        await product.addToCartButton.click();
        await resp;

        await cart.goto();
        initialLineCount = await cart.lineCount();
        initialOrderTotal = parseMoney(await cart.orderTotal.textContent());
        await testInfo.attach('Initial cart lines / order total', {
          body: `line count: ${initialLineCount}\norder total: ${initialOrderTotal}`,
          contentType: 'text/plain',
        });
      });

      await test.step('TC-04-010 #2 — click Continue Shopping', async () => {
        await cart.continueShoppingLink.click();
        // Wait for the navigation to actually complete before reading the
        // URL: page.url() does not wait, so without this the SPR-01 record
        // can capture the cart page the click just left.
        await page.waitForURL(`**${ROUTES.catalog}`);
        await settleForEvidence(page);
        const destination = await recordUrl(page, testInfo, 'Continue Shopping');
        expect.soft(destination).toContain(ROUTES.catalog);
      });

      await test.step('TC-04-010 #3 — reopen cart, compare with initial values', async () => {
        await cart.goto();
        const closingLineCount = await cart.lineCount();
        const closingOrderTotal = parseMoney(await cart.orderTotal.textContent());
        await testInfo.attach('Reopened cart lines / order total', {
          body: `line count: ${closingLineCount} (was ${initialLineCount})\norder total: ${closingOrderTotal} (was ${initialOrderTotal})`,
          contentType: 'text/plain',
        });

        expect.soft(closingLineCount).toBe(initialLineCount);
        expect.soft(closingOrderTotal).toBeCloseTo(initialOrderTotal, 2);
      });

      await test.step('Wrap Up — empty the cart, return to the store home page', async () => {
        const remaining = await cart.lineCount();
        for (let i = remaining - 1; i >= 0; i--) {
          await cart.removeLine(i).click();
        }
        await header.gotoHome();
        await settleForEvidence(page);
      });
    });
  });
});
