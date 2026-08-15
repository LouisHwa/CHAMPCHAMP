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
 *
 * One step in the report - "Environmental cooldown" - is NOT part of the
 * test procedure and carries no coverage. It is an idle pause added
 * because the store's bot checkpoint aborted this procedure at TC-04-010
 * #1 on two separate runs; see the comment at that step for the reasoning
 * and for how to disable it.
 */
test.describe('FN-04 Cart Management', () => {
  test('TP-04-005 cart page controls', async ({ page }, testInfo) => {
    // The procedure itself runs in ~78s, but the environmental cooldown
    // below is deliberately idle time on top of that, so the 90s project
    // timeout would kill the run before TC-04-010 ever starts.
    test.setTimeout(300_000);

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
       * Finds a cart line by product name. This cart lists lines NEWEST
       * FIRST, so index 0 is whichever product was added last - not TD-04-A.
       * TC-04-008 #2 says to remove the TD-04-A line and confirm TD-04-B
       * survives; removeLine(0) did the opposite, removing TD-04-B and
       * leaving TD-04-A. The numeric assertions still passed because they
       * compared against whichever line survived, so the procedure tested
       * the inverse of the document without ever failing. Confirmed by the
       * 11 August run: "remaining line: Striped top" (TD-04-A).
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
            `Lines present: ${await cart.lineCount()}. Re-check the state the previous step left behind.`,
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
        // TPS: "Use the 'Remove' control on the TD-04-A line", expecting the
        // TD-04-B line to survive unchanged. Target both by name, never by
        // index — removeLine(0) on a newest-first cart removed TD-04-B, and
        // every assertion was written against positions rather than the
        // products the step names, so it passed while doing the inverse.
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
        // "the TD-04-B line survives unchanged" - identity, not just amount.
        // A survivor of the wrong product with an equal total would otherwise
        // pass, which is what let the wrong-line removal go unnoticed.
        expect
          .soft(
            (remainingDescription ?? '').toLowerCase(),
            `TC-04-008 #2 expects the surviving line to be ${CART_TEST_DATA.productB} (TD-04-B).`,
          )
          .toContain(CART_TEST_DATA.productB.toLowerCase());
        expect.soft(remainingTotal, 'TC-04-008 #2 expects the surviving line total to be unchanged.').toBeCloseTo(bTotalBefore, 2);
        expect
          .soft(orderTotal, 'TC-04-008 #2 expects the order total to recalculate to the remaining line total.')
          .toBeCloseTo(bTotalBefore, 2);
      });

      await test.step('Reset — empty the cart before the next test case', async () => {
        // Loop rather than assume a single line: if TC-04-008 #2 left the
        // cart in an unexpected state, removeLine(0) alone would leave a
        // line behind and the assertion below would fail here rather than
        // corrupting TC-04-009's starting state.
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
        // TCS #1: "The cart line displays THE PRODUCT with the size and
        // colour selected" - the product identity is part of the expected
        // result, and TC-04-009 exists to prove the link carries THAT line's
        // variant, so the line has to be the right product to begin with.
        expect
          .soft(description.toLowerCase(), 'TC-04-009 #1 expects the cart line to show TD-04-V.')
          .toContain(CART_TEST_DATA.productV.toLowerCase());
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

        // TCS #2: "THE PRODUCT DETAIL PAGE opens with the size and colour of
        // that cart line already selected." The store has a confirmed URL
        // correspondence defect elsewhere (DEF-F2-02, Black heels resolving
        // to flower-print-jeans), so landing on the wrong product with
        // coincidentally matching dropdowns must not read as a pass.
        expect
          .soft(destination, "TC-04-009 #2 expects the link to open TD-04-V's own product detail page.")
          .toContain(CART_TEST_DATA.productVHandle);
        expect.soft(sizeValue, 'TC-04-009 #2 expects the size of the cart line to be pre-selected.').toBe(CART_TEST_DATA.variant2.size);
        expect
          .soft(colourValue, 'TC-04-009 #2 expects the colour of the cart line to be pre-selected. Confirms DEF-F4-08 when it is not.')
          .toBe(CART_TEST_DATA.variant2.colour);
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
      let initialLineTotals: number[] = [];
      let initialOrderTotal = 0;

      /**
       * NOT A PROCEDURE STEP. This is an automation-environment
       * accommodation and carries no coverage: it asserts nothing, reads
       * nothing and changes no state the procedure depends on.
       *
       * TP-04-005 is the heaviest FN-04 procedure (~25-30 navigations in
       * ~78s). Two runs a day apart - 14 August 10:14 after a 16.3h rest,
       * and 15 August 13:53 after a 27.6h rest - both reached the store's
       * "Your connection needs to be verified" checkpoint at exactly this
       * point, TC-04-010 #1, leaving that test case with no result on
       * either occasion. Because the length of the rest BETWEEN runs made
       * no difference, the trigger is request volume WITHIN a run, not a
       * budget that drains overnight.
       *
       * The idle pause tests that reading: if the store's threshold is a
       * rate (requests per window) the counter drains here and TC-04-010
       * completes; if it is an absolute per-session count, the checkpoint
       * still fires and the procedure has to be split or run manually.
       *
       * Set CHECKPOINT_COOLDOWN_MS=0 to disable.
       */
      const cooldownMs = Number(process.env.CHECKPOINT_COOLDOWN_MS ?? 90_000);
      if (cooldownMs > 0) {
        await test.step(`Environmental cooldown — idle ${cooldownMs / 1000}s before TC-04-010`, async () => {
          await testInfo.attach('Environmental cooldown (not a procedure step)', {
            body:
              `idle for ${cooldownMs / 1000}s before TC-04-010 #1.\n` +
              'Accommodates the store checkpoint that aborted this procedure at ' +
              'this exact point on 14 and 15 August. No coverage, no assertions.',
            contentType: 'text/plain',
          });
          await page.waitForTimeout(cooldownMs);
        });
      }

      await test.step('TC-04-010 #1 — add Product A, record cart lines and order total', async () => {
        await product.goto(CART_TEST_DATA.productAHandle);
        const resp = page.waitForResponse((r) => r.url().includes('/cart/add'), { timeout: 10_000 }).catch(() => null);
        await product.addToCartButton.click();
        await resp;

        await cart.goto();
        initialLineCount = await cart.lineCount();
        // TPS: "record the cart LINES and the order total"; TCS: "the order
        // total equals the SUM OF THE LINE TOTALS" (SPR-12). Only the count
        // and the total were recorded, so neither the lines nor the sum
        // relation were available to #3 for comparison.
        initialLineTotals = [];
        for (let i = 0; i < initialLineCount; i++) {
          initialLineTotals.push(parseMoney(await cart.lineTotal(i).textContent()));
        }
        initialOrderTotal = parseMoney(await cart.orderTotal.textContent());

        await testInfo.attach('Initial cart lines / order total', {
          body:
            `line count: ${initialLineCount}\n` +
            `line totals: ${initialLineTotals.join(', ')}\n` +
            `order total: ${initialOrderTotal}`,
          contentType: 'text/plain',
        });

        // TPS Set Up step 8 requires the order total to equal the sum of the
        // line totals (SPR-12); the step recorded both but compared neither.
        expect.soft(initialLineCount, 'TC-04-010 #1 expects the added line to be displayed.').toBeGreaterThan(0);
        expect
          .soft(initialOrderTotal, 'SPR-12: the order total should equal the sum of the line totals.')
          .toBeCloseTo(
            initialLineTotals.reduce((sum, value) => sum + value, 0),
            2,
          );
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
        const closingLineTotals: number[] = [];
        for (let i = 0; i < closingLineCount; i++) {
          closingLineTotals.push(parseMoney(await cart.lineTotal(i).textContent()));
        }
        const closingOrderTotal = parseMoney(await cart.orderTotal.textContent());

        await testInfo.attach('Reopened cart lines / order total', {
          body:
            `line count: ${closingLineCount} (was ${initialLineCount})\n` +
            `line totals: ${closingLineTotals.join(', ')} (were ${initialLineTotals.join(', ')})\n` +
            `order total: ${closingOrderTotal} (was ${initialOrderTotal})`,
          contentType: 'text/plain',
        });

        expect.soft(closingLineCount, 'TC-04-010 #3 expects the cart lines to be unchanged.').toBe(initialLineCount);
        expect.soft(closingLineTotals, 'TC-04-010 #3 expects each line total to be unchanged.').toEqual(initialLineTotals);
        expect
          .soft(closingOrderTotal, 'TC-04-010 #3 expects the order total to be unchanged.')
          .toBeCloseTo(initialOrderTotal, 2);
      });

      await test.step('Wrap Up — empty the cart, return to the store home page', async () => {
        const remaining = await cart.lineCount();
        for (let i = remaining - 1; i >= 0; i--) {
          await clickAndSettle(cart.removeLine(i));
        }
        await cart.goto();
        // TPS Wrap Up: "Empty the cart and CONFIRM THAT IT HAS RETURNED to
        // the empty-cart baseline." Both mid-procedure Resets confirm it;
        // the Wrap Up did not, so a silent failure would hand the next
        // procedure a dirty cart — and every FN-04 Set Up hard-asserts an
        // empty one.
        expect(await cart.lineCount(), 'Wrap Up expects the cart to return to the empty-cart baseline.').toBe(0);
        await header.gotoHome();
        await settleForEvidence(page);
      });
    });
  });
});
