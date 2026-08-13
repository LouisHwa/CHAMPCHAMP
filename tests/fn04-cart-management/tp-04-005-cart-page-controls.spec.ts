import type { Locator } from '@playwright/test';
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
      /**
       * Clicks a control that makes the STORE navigate, and waits for that
       * navigation to land before anything reads the page. Remove is an
       * <a href="/cart/change?...">, the cart line product link is an <a>,
       * and Continue Shopping is an <a>; reading any of them mid-navigation
       * throws "Execution context was destroyed", which would surface as an
       * automation failure rather than a finding about the store.
       */
      async function clickAndSettle(control: Locator) {
        const navigated = page.waitForEvent('framenavigated', { timeout: 15_000 }).catch(() => null);
        await control.click();
        await navigated;
        await page.waitForLoadState('domcontentloaded').catch(() => {});
      }

      /**
       * Finds a cart line by product name. Index-based targeting is wrong
       * here: this cart lists lines NEWEST FIRST, so index 0 is whichever
       * product was added LAST. TD-04-A is added before TD-04-B, so
       * removeLine(0) removes TD-04-B — the opposite of what TPS Set Up
       * step 3 asks for. Confirmed on 12 August against this same store
       * during TP-04-003, where index-based targeting operated on the wrong
       * lines and emptied the cart early.
       */
      async function lineIndexFor(productName: string): Promise<number> {
        for (let attempt = 0; attempt < 2; attempt++) {
          const count = await cart.lineCount();
          for (let i = 0; i < count; i++) {
            const text = (await cart.lineDescription(i).textContent().catch(() => null)) ?? '';
            if (text.toLowerCase().includes(productName.toLowerCase())) return i;
          }
          // One reload before giving up: a miss is usually a stale read taken
          // while the store was still navigating, not an absent line.
          if (attempt === 0) await cart.goto();
        }
        throw new Error(
          `No cart line found for "${productName}" even after reloading /cart. ` +
            `Lines present: ${await cart.lineCount()}.`,
        );
      }

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

        // Totals are identified by product, not by position — the cart is
        // newest-first, so "line 1" and "line 2" say nothing about which
        // product they belong to.
        const aTotal = parseMoney(await cart.lineTotal(await lineIndexFor(CART_TEST_DATA.productA)).textContent());
        const bTotal = parseMoney(await cart.lineTotal(await lineIndexFor(CART_TEST_DATA.productB)).textContent());
        const orderTotal = parseMoney(await cart.orderTotal.textContent());
        await testInfo.attach('Initial line totals / order total', {
          body:
            `${CART_TEST_DATA.productA} (TD-04-A) line total: ${aTotal}\n` +
            `${CART_TEST_DATA.productB} (TD-04-B) line total: ${bTotal}\n` +
            `order total: ${orderTotal}`,
          contentType: 'text/plain',
        });
        expect.soft(orderTotal, 'SPR-12: the order total should equal the sum of the line totals.').toBeCloseTo(aTotal + bTotal, 2);
      });

      await test.step('TC-04-008 #2 — remove the TD-04-A line, TD-04-B survives, order total recalculates', async () => {
        // TPS Set Up step 3 removes TD-04-A specifically and requires TD-04-B
        // to survive UNCHANGED. This previously did removeLine(0), which on a
        // newest-first cart is TD-04-B — so it removed the wrong product and
        // still passed, because every assertion was written against positions
        // rather than against the products named in the step.
        const bTotalBefore = parseMoney(await cart.lineTotal(await lineIndexFor(CART_TEST_DATA.productB)).textContent());
        await clickAndSettle(cart.removeLine(await lineIndexFor(CART_TEST_DATA.productA)));
        await cart.goto();

        const closingLineCount = await cart.lineCount();
        const remainingDescription = closingLineCount > 0 ? await cart.lineDescription(0).textContent() : null;
        const remainingTotal = closingLineCount > 0 ? parseMoney(await cart.lineTotal(0).textContent()) : NaN;
        const orderTotal = parseMoney(await cart.orderTotal.textContent());
        await testInfo.attach('After removing the TD-04-A line', {
          body:
            `removed: ${CART_TEST_DATA.productA} (TD-04-A)\n` +
            `remaining line count: ${closingLineCount}\n` +
            `remaining line: ${remainingDescription?.trim()}\n` +
            `remaining line total: ${remainingTotal} (TD-04-B before removal: ${bTotalBefore})\n` +
            `order total: ${orderTotal}`,
          contentType: 'text/plain',
        });

        expect.soft(closingLineCount, 'TC-04-008 #2 expects one line to remain.').toBe(1);
        // The survivor's identity was recorded but never checked, which is
        // what let the wrong-line removal pass unnoticed.
        expect
          .soft(
            (remainingDescription ?? '').toLowerCase(),
            `TC-04-008 #2 expects the surviving line to be ${CART_TEST_DATA.productB} (TD-04-B).`,
          )
          .toContain(CART_TEST_DATA.productB.toLowerCase());
        expect.soft(remainingTotal, 'TC-04-008 #2 expects TD-04-B to survive unchanged.').toBeCloseTo(bTotalBefore, 2);
        expect
          .soft(orderTotal, 'TC-04-008 #2 expects the order total to equal the remaining line total.')
          .toBeCloseTo(bTotalBefore, 2);
      });

      await test.step('Reset — empty the cart before the next test case', async () => {
        // Loop rather than assuming exactly one line survives: if an earlier
        // step left more behind, a single removal would fail the hard
        // assertion below and abort the two test cases that follow.
        for (let i = (await cart.lineCount()) - 1; i >= 0; i--) {
          await clickAndSettle(cart.removeLine(i));
        }
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
        // Settle before recording: page.url() does not wait, so without this
        // the SPR-01 record can capture /cart — the page the click just left —
        // rather than the product page the step is about. Same fix already
        // applied to Continue Shopping below.
        await clickAndSettle(cart.lineProductLink(0));
        const destination = await recordUrl(page, testInfo, 'Cart line product link');
        expect
          .soft(destination, 'TC-04-009 #2 expects the cart line link to open a product detail page.')
          .toContain('/products/');

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
          await clickAndSettle(cart.removeLine(i));
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
        const lineTotals: number[] = [];
        for (let i = 0; i < initialLineCount; i++) {
          lineTotals.push(parseMoney(await cart.lineTotal(i).textContent()));
        }
        await testInfo.attach('Initial cart lines / order total', {
          body:
            `line count: ${initialLineCount}\n` +
            `line totals: ${lineTotals.join(', ')}\n` +
            `order total: ${initialOrderTotal}`,
          contentType: 'text/plain',
        });

        // TPS Set Up step 8 requires the order total to equal the sum of the
        // line totals (SPR-12); the step recorded both but compared neither.
        expect.soft(initialLineCount, 'TC-04-010 #1 expects the added line to be displayed.').toBeGreaterThan(0);
        expect
          .soft(initialOrderTotal, 'SPR-12: the order total should equal the sum of the line totals.')
          .toBeCloseTo(lineTotals.reduce((a, b) => a + b, 0), 2);
      });

      await test.step('TC-04-010 #2 — click Continue Shopping', async () => {
        await cart.continueShoppingLink.click();
        // Wait for the navigation to actually complete before reading the
        // URL: page.url() does not wait, so without this the SPR-01 record
        // can capture the cart page the click just left.
        // Non-fatal: if Continue Shopping does not reach the catalogue, the
        // soft assertion below records it as the finding and TC-04-010 #3
        // still runs. Letting this throw would abort the procedure and leave
        // #3 undischarged.
        await page.waitForURL(`**${ROUTES.catalog}`, { timeout: 20_000 }).catch(() => null);
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
          await clickAndSettle(cart.removeLine(i));
        }
        await cart.goto();
        // TPS Wrap Up step 1: "Empty the cart and CONFIRM THAT IT HAS
        // RETURNED to the empty-cart baseline." Removal was performed but
        // never confirmed, so a silent failure would hand the next procedure
        // a dirty cart — and every FN-04 Set Up hard-asserts an empty one.
        expect(await cart.lineCount(), 'Wrap Up expects the cart to return to the empty-cart baseline.').toBe(0);
        await header.gotoHome();
        await settleForEvidence(page);
      });
    });
  });
});
