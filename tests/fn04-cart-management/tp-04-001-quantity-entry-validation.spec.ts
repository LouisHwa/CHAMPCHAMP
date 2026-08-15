import type { Locator } from '@playwright/test';
import { test, expect } from '../../utils/pacedTest';
import { HeaderBar } from '../../pages/HeaderBar';
import { ProductPage } from '../../pages/ProductPage';
import { CartPage } from '../../pages/CartPage';
import { CatalogPage } from '../../pages/CatalogPage';
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
    const catalog = new CatalogPage(page);
    const product = new ProductPage(page);
    const cart = new CartPage(page);

    await withFailureEvidence(page, testInfo, async () => {
      /**
       * Clicks a control that makes the STORE navigate, and waits for that
       * navigation to land before anything else runs. Update is a form POST
       * and Remove is an <a href="/cart/change?...">, so both reload the page
       * on their own; issuing the next goto() or read while that is still in
       * flight produces "Execution context was destroyed" or an interrupted
       * navigation, either of which surfaces as an automation failure rather
       * than a finding about the store.
       */
      async function clickAndSettle(control: Locator) {
        const navigated = page.waitForEvent('framenavigated', { timeout: 15_000 }).catch(() => null);
        await control.click();
        await navigated;
        await page.waitForLoadState('domcontentloaded').catch(() => {});
      }

      await test.step('Set Up — confirm empty cart baseline', async () => {
        await cart.goto();
        expect(await cart.lineCount()).toBe(0);
        await header.gotoHome();
      });

      await test.step('Set Up — open TD-04-A from the catalogue', async () => {
        // TPS Set Up step 3: "Select TD-04-A FROM THE CATALOGUE" — reach the
        // PDP the way the step describes rather than jumping straight to the
        // handle. TC-04-001 #1 then records the unit price from this page.
        //
        // This step used to be labelled a stock-quantity check, on the basis
        // that the TPS carried one into TP-04-001's Set Up tagged
        // [TC-04-004 #1]. The 11 August TPS does not: TP-04-001's Set Up runs
        // 1-13 with no stock step, and the stock check belongs to TP-04-002
        // Set Up step 3, which owns TC-04-004 #1. Presenting it here made the
        // report show a step with no counterpart in the document and appear
        // to discharge another procedure's coverage item. The reading is kept
        // as incidental evidence only — it asserts nothing and carries no tag.
        await catalog.goto();
        await clickAndSettle(catalog.productLink(CART_TEST_DATA.productA));

        const stockIndicator = page.locator('#buy').getByText(/\d+\s*(in stock|available|left)/i);
        const stockShown = await stockIndicator.isVisible().catch(() => false);
        await testInfo.attach('PDP opened from the catalogue (incidental: stock display)', {
          body:
            `product: ${CART_TEST_DATA.productA} (TD-04-A)\n` +
            `destination: ${page.url()}\n` +
            `stock indicator visible: ${stockShown} (incidental observation; TC-04-004 #1 is discharged by TP-04-002)`,
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

        expect.soft(lineCount, 'TC-04-001 #1 expects one line for the product added.').toBe(1);
        // "one line FOR THE PRODUCT ADDED" - identity is part of the expected
        // result, so a line for a different product must not satisfy it.
        expect
          .soft((lineDescription ?? '').toLowerCase(), 'TC-04-001 #1 expects the line to be TD-04-A.')
          .toContain(CART_TEST_DATA.productA.toLowerCase());
      });

      await test.step('TC-04-001 #2 — commit quantity 1', async () => {
        // SPR-13: "commit the value using a control the page provides AND
        // RECORD THE METHOD USED". The method was never recorded, even though
        // the same SPR draws the typed-vs-committed distinction this whole
        // procedure rests on.
        await testInfo.attach('SPR-13 - quantity commit method', {
          body:
            'Every quantity in this procedure is committed by clicking the ' +
            "cart page's own Update control (#update), never by typing alone. " +
            'A value typed into the field but not committed is not a submitted quantity.',
          contentType: 'text/plain',
        });

        await cart.goto();
        await cart.lineQuantityInput(0).fill('1');
        await clickAndSettle(cart.updateButton);
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
        await clickAndSettle(cart.updateButton);
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
        await clickAndSettle(cart.removeLine(0));
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
        expect.soft(lineDisplayed, 'TC-04-002 #1 expects one line for the product added.').toBe(1);
        expect
          .soft((lineDescription ?? '').toLowerCase(), 'TC-04-002 #1 expects the line to be TD-04-A.')
          .toContain(CART_TEST_DATA.productA.toLowerCase());
      });

      await test.step('TC-04-002 #2 — set quantity to 0, line removed, order total returns to nothing', async () => {
        await cart.lineQuantityInput(0).fill('0');
        await clickAndSettle(cart.updateButton);
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
        await clickAndSettle(cart.updateButton);
        await cart.goto();

        const baselineQty = await cart.lineQuantityInput(0).inputValue();
        const baselineLineTotal = parseMoney(await cart.lineTotal(0).textContent());
        await testInfo.attach('TC-04-003 #1 - baseline quantity 2', {
          body: `committed quantity: ${baselineQty}\nunit price: ${unitPrice}\nline total: ${baselineLineTotal}`,
          contentType: 'text/plain',
        });

        expect.soft(baselineQty, 'TC-04-003 #1 expects the quantity of 2 to be accepted.').toBe('2');
        // TCS #1: "...AND THE LINE TOTAL EQUALS TWO UNIT PRICES." Only the
        // field value was checked, so a quantity that read 2 while the total
        // said otherwise would have passed.
        expect
          .soft(baselineLineTotal, 'TC-04-003 #1 expects the line total to equal two unit prices.')
          .toBeCloseTo(2 * unitPrice, 2);
      });

      // Each TCS step here carries two or three expected results, not one.
      // Only the validation message was ever asserted, so the half the store
      // gets right - retaining the previous quantity - went unverified, and
      // the report could not distinguish "reverted silently" (the DEF-F4-03
      // wording) from "did something else entirely".
      const invalidValues: { label: string; value: string; step: string; alsoExpects: string }[] = [
        { label: 'negative (-5)', value: '-5', step: 'TC-04-003 #2', alsoExpects: 'no negative line total is produced' },
        { label: 'non-numeric (abc)', value: 'abc', step: 'TC-04-003 #3', alsoExpects: 'the value does not revert silently' },
        { label: 'fractional (2.5)', value: '2.5', step: 'TC-04-003 #4', alsoExpects: 'the integer-only rule is enforced' },
        { label: 'empty', value: '', step: 'TC-04-003 #5', alsoExpects: 'the empty value is rejected' },
      ];

      for (const invalid of invalidValues) {
        await test.step(`${invalid.step} — quantity "${invalid.value || '(empty)'}"`, async () => {
          await cart.lineQuantityInput(0).fill(invalid.value);
          await clickAndSettle(cart.updateButton);
          await cart.goto();

          const messageLocator = page.locator('#cart .error, #cart .message, #cart [class*="error"]');
          const messageShown = (await messageLocator.count()) > 0;
          const messageText = messageShown ? ((await messageLocator.first().innerText()) ?? '').trim() : null;
          // Read back defensively. If an invalid value ever removed the line
          // outright, lineQuantityInput(0) would throw and abort the whole
          // procedure — taking the remaining invalid values with it and
          // discharging none of them. A vanished line is itself a finding,
          // so record it and let the assertions below report it.
          const lineStillPresent = (await cart.lineCount()) > 0;
          const quantityAfter = lineStillPresent
            ? await cart.lineQuantityInput(0).inputValue().catch(() => '(unreadable)')
            : '(line removed)';
          const lineTotalAfter = lineStillPresent
            ? parseMoney(await cart.lineTotal(0).textContent().catch(() => null))
            : NaN;

          await testInfo.attach(`Quantity "${invalid.value || '(empty)'}" — system response`, {
            body:
              `explicit validation message shown: ${messageShown}\n` +
              `message text: ${messageText ?? '(none)'}\n` +
              `cart line still present: ${lineStillPresent}\n` +
              `quantity field value after commit: ${quantityAfter} (baseline was 2)\n` +
              `line total after commit: ${lineTotalAfter} (2 x ${unitPrice} = ${2 * unitPrice})\n` +
              `also expected by the TCS: ${invalid.alsoExpects}`,
            contentType: 'text/plain',
          });

          // Expected result 1 - the explicit validation message (DEF-F4-03).
          expect
            .soft(messageShown, `TC-04-003 expects an explicit validation message for ${invalid.label} input.`)
            .toBe(true);
          // Expected result 2 - "the previous quantity is retained", stated in
          // all four steps. This is the half the store does satisfy, so
          // asserting it turns each step into a precise finding rather than a
          // bare failure.
          expect
            .soft(quantityAfter, `TC-04-003 expects the previous quantity (2) to be retained after ${invalid.label} input.`)
            .toBe('2');
          // Expected result 3 - "no negative line total is produced" (#2 only).
          if (invalid.value === '-5' && !Number.isNaN(lineTotalAfter)) {
            expect
              .soft(lineTotalAfter, 'TC-04-003 #2 expects no negative line total to be produced.')
              .toBeGreaterThanOrEqual(0);
          }
        });
      }

      await test.step('Wrap Up — remove the test product, return to baseline', async () => {
        await cart.goto();
        const remaining = await cart.lineCount();
        for (let i = remaining - 1; i >= 0; i--) {
          await clickAndSettle(cart.removeLine(i));
        }
        await cart.goto();
        // TPS Wrap Up: "Remove the test product from the cart and CONFIRM
        // THAT THE CART RETURNS to the empty-cart baseline."
        expect(await cart.lineCount(), 'Wrap Up expects the cart to return to the empty-cart baseline.').toBe(0);
        await header.gotoHome();
      });
    });
  });
});
