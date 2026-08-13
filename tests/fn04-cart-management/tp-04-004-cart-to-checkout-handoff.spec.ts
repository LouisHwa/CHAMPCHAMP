import { test, expect } from '../../utils/pacedTest';
import { HeaderBar } from '../../pages/HeaderBar';
import { ProductPage } from '../../pages/ProductPage';
import { CartPage } from '../../pages/CartPage';
import { CatalogPage } from '../../pages/CatalogPage';
import { CART_TEST_DATA } from '../../fixtures/test-data';
import { parseMoney, withFailureEvidence } from '../../utils/evidence';

/**
 * TP-04-004 — Verify a selected variant is added to the cart and carried
 * through to the checkout handoff with the correct items, quantities,
 * total and order note. Covers TC-04-007 (#1 to #5), renumbered from
 * the old TP-04-007 per the refined TPS FN-04. Test data (Noir jacket,
 * TD-04-V1 = M/Blue, TD-04-N order note) already matched the refined
 * document's bindings, so no data change was needed here.
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
 * Expected failure here confirms DEF-F4-07: an order note entered in the cart is
 * not displayed at checkout. The variant/quantity/total handoff itself
 * (#1 to #4) has no known defect and should pass; only the order-note
 * check (#5) is expected to fail, so a correct run reports exactly one
 * failed assertion.
 *
 * Wrapped in withFailureEvidence so an unrelated breakage still leaves
 * a labelled screenshot and page text behind alongside Playwright's
 * own capture.
 */
test.describe('FN-04 Cart Management', () => {
  test('TP-04-004 cart to checkout handoff', async ({ page }, testInfo) => {
    const header = new HeaderBar(page);
    const catalog = new CatalogPage(page);
    const product = new ProductPage(page);
    const cart = new CartPage(page);

    // Recorded in the cart so #4 can check the checkout shows "the same
    // items, quantities and total as the cart" — the comparison the TC is
    // built around. Previously #4 only checked the product name appeared.
    let unitPrice = NaN;
    let cartQuantity: string | null = null;
    let cartLineTotal: number = NaN;
    let cartOrderTotal: number = NaN;

    await withFailureEvidence(page, testInfo, async () => {
      await test.step('Set Up — confirm empty cart baseline', async () => {
        await cart.goto();
        expect(await cart.lineCount()).toBe(0);
        await header.gotoHome();
      });

      await test.step('TC-04-007 #1 — select Noir jacket, TD-04-V1 (size M, colour Blue), add to cart', async () => {
        // Both the TCS and the TPS say "select TD-04-V FROM THE CATALOGUE",
        // so reach the PDP the way the step describes rather than jumping
        // straight to the handle.
        await catalog.goto();
        await catalog.productLink(CART_TEST_DATA.productV).click();
        await page.waitForLoadState('domcontentloaded');

        await product.selectSize(CART_TEST_DATA.variant1.size);
        await product.selectColour(CART_TEST_DATA.variant1.colour);

        // Unit price is only readable here, on the PDP — TPS #2 asks for the
        // price to be recorded and the cart line does not show it separately.
        unitPrice = parseMoney(await product.price.textContent());

        const resp = page.waitForResponse((r) => r.url().includes('/cart/add'), { timeout: 10_000 }).catch(() => null);
        await product.addToCartButton.click();
        const addResponse = await resp;

        await testInfo.attach('TC-04-007 #1 — variant added', {
          body:
            `product: ${CART_TEST_DATA.productV}
` +
            `size selected: ${await product.sizeSelect.inputValue()}
` +
            `colour selected: ${await product.colourSelect.inputValue()}
` +
            `unit price recorded: ${unitPrice}
` +
            `/cart/add response: ${addResponse ? addResponse.status() : 'not observed within 10s'}`,
          contentType: 'text/plain',
        });

        // TCS #1: "The exact selected variant is added to the cart." The step
        // previously asserted nothing at all, leaving #1 unverified in the report.
        expect
          .soft(addResponse?.ok() ?? false, 'TC-04-007 #1 expects the selected variant to be added to the cart.')
          .toBe(true);
      });

      await test.step('TC-04-007 #2 — cart line shows name, variant, quantity, totals', async () => {
        await cart.goto();
        const description = (await cart.lineDescription(0).textContent()) ?? '';
        const lineTotalText = await cart.lineTotal(0).textContent();
        const orderTotalText = await cart.orderTotal.textContent();
        cartQuantity = await cart.lineQuantityInput(0).inputValue();
        cartLineTotal = parseMoney(lineTotalText);
        cartOrderTotal = parseMoney(orderTotalText);
        await testInfo.attach('Cart line — description / totals', {
          body:
            `product name expected: ${CART_TEST_DATA.productV}\n` +
            `line description: ${description.trim()}\n` +
            `unit price (from PDP): ${unitPrice}\n` +
            `quantity: ${cartQuantity}\n` +
            `line total: ${lineTotalText}\n` +
            `order total: ${orderTotalText}`,
          contentType: 'text/plain',
        });

        // TCS #2: "the correct PRODUCT NAME, price and variant, with a
        // quantity of 1". The name was never asserted, so a line for the
        // wrong product carrying the right variant string would have passed.
        expect
          .soft(description.toLowerCase(), 'TC-04-007 #2 expects the cart line to show the correct product name.')
          .toContain(CART_TEST_DATA.productV.toLowerCase());
        expect.soft(description).toContain(CART_TEST_DATA.variant1.size);
        expect.soft(description).toContain(CART_TEST_DATA.variant1.colour);
        expect.soft(cartQuantity, 'TC-04-007 #2 expects a quantity of 1.').toBe('1');

        // SPR-12: the order total is checked as the sum of the line totals.
        if (!Number.isNaN(cartLineTotal) && !Number.isNaN(cartOrderTotal)) {
          expect
            .soft(cartOrderTotal, 'SPR-12: the order total should equal the sum of the line totals.')
            .toBeCloseTo(cartLineTotal, 2);
        }
      });

      await test.step('TC-04-007 #3 — enter order note, record acceptance', async () => {
        await cart.noteField.fill(CART_TEST_DATA.orderNote);
        await cart.updateButton.click();
        await cart.goto();
        const noteValue = await cart.noteField.inputValue();
        await testInfo.attach('Order note — persisted value', {
          body: noteValue,
          contentType: 'text/plain',
        });
        expect.soft(noteValue).toBe(CART_TEST_DATA.orderNote);
      });

      await test.step('TC-04-007 #4 — Checkout opens with items, quantities, subtotal, total', async () => {
        await cart.checkoutButton.click();
        await page.waitForURL(/\/checkouts\//, { timeout: 20_000 }).catch(() => null);
        const summaryText = await page.locator('body').innerText();
        const showsItem = summaryText.toLowerCase().includes(CART_TEST_DATA.productV.toLowerCase());
        // Compare on numeric value, not the formatted string: the cart and
        // the checkout render currency differently.
        const checkoutAmounts = (summaryText.match(/\d[\d,]*\.\d{2}/g) ?? []).map((a) => parseMoney(a));
        const showsTotal = checkoutAmounts.some((a) => Math.abs(a - cartOrderTotal) < 0.01);
        const showsQuantity = cartQuantity !== null && new RegExp(`\\b${cartQuantity}\\b`).test(summaryText);
        await testInfo.attach('Checkout page — shows cart item', {
          body:
            `cart recorded - item: ${CART_TEST_DATA.productV} / variant: ` +
            `${CART_TEST_DATA.variant1.size} ${CART_TEST_DATA.variant1.colour} / quantity: ${cartQuantity} / ` +
            `line total: ${cartLineTotal} / order total: ${cartOrderTotal}\n` +
            `checkout shows item: ${showsItem}\n` +
            `checkout shows quantity: ${showsQuantity}\n` +
            `checkout shows the cart order total: ${showsTotal}\n` +
            `money amounts found on checkout: ${checkoutAmounts.join(', ') || '(none)'}`,
          contentType: 'text/plain',
        });
        // TCS #4: "the checkout opens displaying the SAME ITEMS, QUANTITIES
        // AND TOTAL as the cart." Only item-name presence was checked before,
        // so a different quantity or total at checkout would have passed.
        expect.soft(showsItem, 'TC-04-007 #4 expects the checkout to display the same item as the cart.').toBe(true);
        expect
          .soft(showsQuantity, 'TC-04-007 #4 expects the checkout to display the same quantity as the cart.')
          .toBe(true);
        expect
          .soft(showsTotal, 'TC-04-007 #4 expects the checkout to display the same total as the cart.')
          .toBe(true);
      });

      await test.step('TC-04-007 #5 — checkout summary shows the order note', async () => {
        const summaryText = await page.locator('body').innerText();
        const noteVisible = summaryText.includes(CART_TEST_DATA.orderNote);
        await testInfo.attach('Checkout page — order note visibility', {
          body: `order note "${CART_TEST_DATA.orderNote}" visible on checkout page: ${noteVisible}`,
          contentType: 'text/plain',
        });
        expect.soft(noteVisible, 'TC-04-007 expects the cart order note to appear in the checkout summary.').toBe(true);
      });

      await test.step('Wrap Up — navigate away from checkout, empty cart, return home', async () => {
        await header.gotoHome();
        await cart.goto();
        const remaining = await cart.lineCount();
        for (let i = remaining - 1; i >= 0; i--) {
          await cart.removeLine(i).click();
        }
        await cart.goto();
        // TPS Wrap Up: "Empty the cart and CONFIRM THAT IT RETURNS to the
        // empty-cart baseline." Removal was performed but never confirmed, so
        // a silent failure would hand the next procedure a dirty cart.
        expect(await cart.lineCount(), 'Wrap Up expects the cart to return to the empty-cart baseline.').toBe(0);
        await header.gotoHome();
      });
    });
  });
});
