import type { Locator } from '@playwright/test';
import { test, expect } from '../../utils/pacedTest';
import { HeaderBar } from '../../pages/HeaderBar';
import { ProductPage } from '../../pages/ProductPage';
import { CartPage } from '../../pages/CartPage';
import { CART_TEST_DATA, ROUTES } from '../../fixtures/test-data';
import { parseMoney, recordUrl, settleForEvidence, withFailureEvidence } from '../../utils/evidence';

/**
 * TP-04-007 — Verify that Continue Shopping returns the shopper to the
 * catalogue with the cart contents unchanged. Covers TC-04-010.
 *
 * The TPS titles this table "Cart Resumption Test Procedure"; the file is
 * named after the control under test instead, because TP-04-006 is also
 * "cart resumption" and covers something entirely different (TC-04-011/
 * 012/013, a cart surviving a browser or session change).
 *
 * TC-04-010 used to be the third test case of TP-04-005 and moved here
 * when the TPS was refined. That split also resolves an environmental
 * problem: TP-04-005 was the heaviest FN-04 procedure and the store's
 * "Your connection needs to be verified" checkpoint aborted it at
 * TC-04-010 #1 on two separate runs (14 and 15 August), leaving this test
 * case with no result both times. Because the rest between those runs
 * (16.3h and 27.6h) made no difference, the trigger was request volume
 * WITHIN a run — which a procedure this short does not reach, so no
 * cooldown accommodation is carried over.
 *
 * Both TD-04-A and TD-04-B are added at Set Up step 2 per the TPS note:
 * SPR-12 checks the order total against the SUM of the line totals, which
 * is not a meaningful assertion against a single line.
 *
 * Every expected-result check is expect.soft(), so a failure is recorded
 * and execution CONTINUES to the end of the procedure — one run surfaces
 * every unmet result rather than stopping at the first. The Set Up
 * empty-cart precondition and the Wrap Up baseline stay hard: if the cart
 * is not empty when the procedure starts, the run is invalid, and if it is
 * not empty when the procedure ends, the next FN-04 procedure's Set Up
 * fails instead of this one.
 *
 * No known defect affects Continue Shopping, so a correct run reports no
 * failures.
 *
 * Wrapped in withFailureEvidence so an unrelated breakage still leaves
 * a labelled screenshot and page text behind alongside Playwright's
 * own capture.
 */
test.describe('FN-04 Cart Management', () => {
  test('TP-04-007 continue shopping', async ({ page }, testInfo) => {
    // Short procedure (~8 navigations), but at slowMo 600 against a store
    // whose /cart navigation has taken 45s, the 90s project timeout leaves
    // no headroom. In line with the budgets the other FN-04 specs set.
    test.setTimeout(120_000);

    const header = new HeaderBar(page);
    const product = new ProductPage(page);
    const cart = new CartPage(page);

    await withFailureEvidence(page, testInfo, async () => {
      /**
       * Clicks a control that makes the STORE navigate, and waits for that
       * navigation to land before anything reads the page. Remove is an
       * <a href="/cart/change?...">; reading it mid-navigation throws
       * "Execution context was destroyed", which would surface as an
       * automation failure rather than a finding about the store.
       */
      async function clickAndSettle(control: Locator) {
        const navigated = page.waitForEvent('framenavigated', { timeout: 15_000 }).catch(() => null);
        await control.click();
        await navigated;
        await page.waitForLoadState('domcontentloaded').catch(() => {});
      }

      /**
       * TPS: "record the cart LINES and the order total", and TC-04-010 #3
       * compares them. Descriptions are recorded alongside the totals so
       * "unchanged" means the same products at the same amounts — two
       * lines whose totals happen to match would otherwise pass a
       * count-and-total comparison.
       */
      async function readCart() {
        const count = await cart.lineCount();
        const descriptions: string[] = [];
        const totals: number[] = [];
        for (let i = 0; i < count; i++) {
          descriptions.push(((await cart.lineDescription(i).textContent()) ?? '').trim().replace(/\s+/g, ' '));
          totals.push(parseMoney(await cart.lineTotal(i).textContent()));
        }
        return { count, descriptions, totals, orderTotal: parseMoney(await cart.orderTotal.textContent()) };
      }

      function describeCart(snapshot: Awaited<ReturnType<typeof readCart>>) {
        return (
          `line count: ${snapshot.count}\n` +
          `lines: ${snapshot.descriptions.join(' | ')}\n` +
          `line totals: ${snapshot.totals.join(', ')}\n` +
          `order total: ${snapshot.orderTotal}`
        );
      }

      let initial: Awaited<ReturnType<typeof readCart>>;
      let closing: Awaited<ReturnType<typeof readCart>>;
      let continueShoppingUrl = '';

      await test.step('Set Up #1 — confirm empty cart baseline', async () => {
        await cart.goto();
        expect(await cart.lineCount()).toBe(0);
        await header.gotoHome();
      });

      await test.step('Set Up #2 / TC-04-010 #1 — add TD-04-A and TD-04-B, record cart lines and order total', async () => {
        for (const handle of [CART_TEST_DATA.productAHandle, CART_TEST_DATA.productBHandle]) {
          await product.goto(handle);
          const resp = page.waitForResponse((r) => r.url().includes('/cart/add'), { timeout: 10_000 }).catch(() => null);
          await product.addToCartButton.click();
          await resp;
        }

        await cart.goto();
        initial = await readCart();
        await testInfo.attach('Initial cart lines / order total', {
          body: describeCart(initial),
          contentType: 'text/plain',
        });

        // "Confirm that the cart displays THE LINES ADDED" — both products
        // by name, not just a count of two. The cart lists lines newest
        // first, so position says nothing about which product a line is.
        expect.soft(initial.count, 'TC-04-010 #1 expects both added lines to be displayed.').toBe(2);
        const lines = initial.descriptions.join(' | ').toLowerCase();
        expect.soft(lines, `TC-04-010 #1 expects a line for ${CART_TEST_DATA.productA} (TD-04-A).`).toContain(
          CART_TEST_DATA.productA.toLowerCase(),
        );
        expect.soft(lines, `TC-04-010 #1 expects a line for ${CART_TEST_DATA.productB} (TD-04-B).`).toContain(
          CART_TEST_DATA.productB.toLowerCase(),
        );
        expect
          .soft(initial.orderTotal, 'SPR-12: the order total should equal the sum of the line totals.')
          .toBeCloseTo(
            initial.totals.reduce((sum, value) => sum + value, 0),
            2,
          );
      });

      await test.step('Set Up #3 / TC-04-010 #2 — select Continue Shopping, record the destination URL', async () => {
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
        continueShoppingUrl = await recordUrl(page, testInfo, 'Continue Shopping');
        expect
          .soft(continueShoppingUrl, 'TC-04-010 #2 expects Continue Shopping to return the shopper to the catalogue.')
          .toContain(ROUTES.catalog);
      });

      await test.step('Set Up #4 / TC-04-010 #3 — reopen the cart, compare with the initial values', async () => {
        await cart.goto();
        closing = await readCart();
        await testInfo.attach('Reopened cart lines / order total', {
          body: `${describeCart(closing)}\n\n--- recorded at TC-04-010 #1 ---\n${describeCart(initial)}`,
          contentType: 'text/plain',
        });

        expect.soft(closing.count, 'TC-04-010 #3 expects the cart lines to be unchanged.').toBe(initial.count);
        expect.soft(closing.descriptions, 'TC-04-010 #3 expects the same products on the same lines.').toEqual(initial.descriptions);
        expect.soft(closing.totals, 'TC-04-010 #3 expects each line total to be unchanged.').toEqual(initial.totals);
        expect.soft(closing.orderTotal, 'TC-04-010 #3 expects the order total to be unchanged.').toBeCloseTo(initial.orderTotal, 2);
      });

      await test.step('Wrap Up #1 — empty the cart, confirm the empty-cart baseline', async () => {
        // Loop rather than assume two lines: if a step above left the cart
        // in an unexpected state, removing a fixed number would leave a line
        // behind, and every FN-04 Set Up hard-asserts an empty cart.
        for (let i = (await cart.lineCount()) - 1; i >= 0; i--) {
          await clickAndSettle(cart.removeLine(i));
        }
        await cart.goto();
        expect(await cart.lineCount(), 'Wrap Up expects the cart to return to the empty-cart baseline.').toBe(0);
      });

      await test.step('Wrap Up #2 — return to the store home page', async () => {
        await header.gotoHome();
        await settleForEvidence(page);
      });

      await test.step('Wrap Up #3 — attach the recorded values to the test log', async () => {
        // The individual records are attached at the steps that took them;
        // this is the single before/after comparison the TPS asks for, so
        // the test log carries one artefact holding the whole result.
        await testInfo.attach('TC-04-010 — cart before and after Continue Shopping', {
          body:
            `Continue Shopping destination URL: ${continueShoppingUrl}\n\n` +
            `BEFORE (TC-04-010 #1)\n${describeCart(initial)}\n\n` +
            `AFTER (TC-04-010 #3)\n${describeCart(closing)}`,
          contentType: 'text/plain',
        });
      });
    });
  });
});
