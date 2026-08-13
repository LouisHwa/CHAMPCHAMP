import { test, expect } from '../../utils/pacedTest';
import { HeaderBar } from '../../pages/HeaderBar';
import { ProductPage } from '../../pages/ProductPage';
import { CartPage } from '../../pages/CartPage';
import { CartDrawer } from '../../pages/CartDrawer';
import { CART_TEST_DATA } from '../../fixtures/test-data';
import { parseMoney, withFailureEvidence } from '../../utils/evidence';

/**
 * TP-04-003 — Verify the cart transitions from empty through populated
 * and back to empty, with totals recalculated on each change and the
 * cart icon and contents updated without a manual refresh. Covers
 * TC-04-006 (#1 to #10), renumbered from the old TP-04-006 per the
 * refined TPS FN-04, and now using TD-04-A/TD-04-B (Striped top / Grey
 * jacket) rather than Bronze sandals/Striped top.
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
 * Expected failures here confirm DEF-F4-01 (cart never updates in real time — a
 * manual refresh is required before a change appears) and DEF-F4-02 (the
 * quantity field's totals only update on Update-click/Enter, not
 * on-change). Each transition checks BOTH the header cart count and the
 * minicart contents immediately after the action, WITHOUT navigating —
 * SPR-11 requires the icon count and the cart contents to be observed as
 * they stand, and the TC expects both to already reflect the change. A
 * forced reload afterwards confirms the underlying state did change
 * server-side, so this evidences "not live", not "didn't happen".
 *
 * Wrapped in withFailureEvidence so an unrelated breakage still leaves
 * a labelled screenshot and page text behind alongside Playwright's
 * own capture.
 *
 * Intercase dependency: TP-04-001's zero-quantity removal step.
 */
test.describe('FN-04 Cart Management', () => {
  test('TP-04-003 cart state transitions', async ({ page }, testInfo) => {
    const header = new HeaderBar(page);
    const product = new ProductPage(page);
    const cart = new CartPage(page);

    // Captured at #3 (quantity 1) so #4 can verify the totals actually
    // reflect the committed quantity of 2, not merely that the field says 2.
    let lineTotalAtQty1: string | null = null;

    await withFailureEvidence(page, testInfo, async () => {
      /**
       * Finds a cart line by product name. Index-based targeting is wrong
       * here: this cart lists lines NEWEST FIRST, so index 0 is whichever
       * product was added last, not TD-04-A. Confirmed on 12 August — the
       * step that meant to set TD-04-A's quantity to 2 actually set
       * TD-04-B's (line total came back £110.00 = 2 × £55.00, Grey jacket's
       * price, not Striped top's £50.00), and the removal steps then took
       * out the wrong lines and emptied the cart early, so #8, #9 and #10
       * never ran at all.
       */
      async function lineIndexFor(productName: string): Promise<number> {
        const count = await cart.lineCount();
        for (let i = 0; i < count; i++) {
          const text = (await cart.lineDescription(i).textContent()) ?? '';
          if (text.toLowerCase().includes(productName.toLowerCase())) return i;
        }
        throw new Error(
          `No cart line found for "${productName}". Lines present: ${count}. ` +
            'Re-check the state the previous step left behind.',
        );
      }

      /** Order total as displayed, trimmed; null if it cannot be read. */
      async function readOrderTotal(): Promise<string | null> {
        return (await cart.orderTotal.textContent().catch(() => null))?.trim() ?? null;
      }

      /**
       * Every TC-04-006 step requires the cart icon count AND the cart
       * CONTENTS to update without a manual refresh (SPR-11: "do not reload
       * the page... observe the cart icon count and the cart contents as
       * they stand immediately after the action").
       *
       * The header count alone only evidences half of that. The minicart
       * drawer is the on-page view of the cart contents, so it is read here
       * too — while still on the page the action left us on, before any
       * navigation. The drawer is a server-rendered snapshot from page load
       * (see CartDrawer.ts), which is exactly why it is the right
       * instrument: if the contents genuinely updated live it would show
       * them, and if it lags that lag IS the DEF-F4-01 finding.
       *
       * Only after both live readings does this reload, to record what the
       * state actually became server-side — so the report distinguishes
       * "not live" from "didn't happen".
       */
      async function checkLiveCartState(label: string, expectedCount: string, expectedLines: number) {
        const liveHeaderText = await header.cartCount.textContent().catch(() => null);
        const drawer = new CartDrawer(page);
        const liveDrawerLines = await drawer
          .open()
          .then(() => drawer.lineCount())
          .catch(() => -1);

        await cart.goto();
        const actualLineCount = await cart.lineCount();
        const orderTotalAfter = await readOrderTotal();

        await testInfo.attach(`${label} — live vs reloaded state`, {
          body:
            `header count shown without reload: ${liveHeaderText}\n` +
            `expected header count: (${expectedCount})\n` +
            `cart contents shown without reload (minicart lines): ${liveDrawerLines === -1 ? '(drawer unreadable)' : liveDrawerLines}\n` +
            `expected contents lines: ${expectedLines}\n` +
            `line count after reload: ${actualLineCount}\n` +
            `order total after reload: ${orderTotalAfter}`,
          contentType: 'text/plain',
        });

        expect
          .soft(liveHeaderText?.trim(), `${label}: header cart count should already read ${expectedCount} without a reload.`)
          .toBe(expectedCount);
        expect
          .soft(liveDrawerLines, `${label}: cart contents should already show ${expectedLines} line(s) without a reload.`)
          .toBe(expectedLines);

        return { actualLineCount, orderTotalAfter };
      }

      await test.step('Set Up — confirm empty cart baseline (S1)', async () => {
        await cart.goto();
        expect(await cart.lineCount()).toBe(0);
        await header.gotoHome();
      });

      await test.step('TC-04-006 #1 — add product A (S1 -> S2, line count 1)', async () => {
        await product.goto(CART_TEST_DATA.productAHandle);
        const resp = page.waitForResponse((r) => r.url().includes('/cart/add'), { timeout: 10_000 }).catch(() => null);
        await product.addToCartButton.click();
        await resp;
        await checkLiveCartState('Add product A', '(1)', 1);
      });

      await test.step('TC-04-006 #2 — add product B, a distinct product (line count 2)', async () => {
        await product.goto(CART_TEST_DATA.productBHandle);
        const resp = page.waitForResponse((r) => r.url().includes('/cart/add'), { timeout: 10_000 }).catch(() => null);
        await product.addToCartButton.click();
        await resp;
        await checkLiveCartState('Add product B', '(2)', 2);
      });

      await test.step('TC-04-006 #3 — change quantity on product A to 2 WITHOUT committing', async () => {
        await cart.goto();
        const aIndex = await lineIndexFor(CART_TEST_DATA.productA);

        // TCS/TPS #3 both say "record BOTH line totals and the order total",
        // and SPR-12 wants each line total separately so the order total can
        // be checked as their sum — so capture every line, not just TD-04-A's.
        const lineTotalsBefore: string[] = [];
        for (let i = 0; i < (await cart.lineCount()); i++) {
          lineTotalsBefore.push((await cart.lineTotal(i).textContent().catch(() => null))?.trim() ?? '(unreadable)');
        }
        const lineTotalBefore = lineTotalsBefore[aIndex] ?? null;
        lineTotalAtQty1 = lineTotalBefore;
        const orderTotalBefore = await readOrderTotal();

        // No Update click here: the TPS separates changing the field from
        // committing it, and this step asks only whether the totals
        // recalculate as soon as the field value changes.
        await cart.lineQuantityInput(aIndex).fill('2');
        await page.waitForTimeout(1_000);

        const lineTotalsAfter: string[] = [];
        for (let i = 0; i < (await cart.lineCount()); i++) {
          lineTotalsAfter.push((await cart.lineTotal(i).textContent().catch(() => null))?.trim() ?? '(unreadable)');
        }
        const lineTotalAfter = lineTotalsAfter[aIndex] ?? null;
        const orderTotalAfter = await readOrderTotal();
        const recalculated = lineTotalBefore !== lineTotalAfter || orderTotalBefore !== orderTotalAfter;

        await testInfo.attach('Uncommitted quantity change — totals before and after the field edit', {
          body:
            `quantity field set to: 2 (NOT committed)\n` +
            `line totals before: ${lineTotalsBefore.join(', ')}\n` +
            `line totals after:  ${lineTotalsAfter.join(', ')}\n` +
            `TD-04-A line total before: ${lineTotalBefore}   after: ${lineTotalAfter}\n` +
            `order total        before: ${orderTotalBefore}   after: ${orderTotalAfter}\n` +
            `recalculated on field change alone: ${recalculated}`,
          contentType: 'text/plain',
        });

        // TC-04-006 names DEF-F4-02 (Quantity change total recalculation) as
        // a Defect Confirmed, and #3 is the only step that can expose it. The
        // TCS expected result is unambiguous: the totals "recalculate to
        // reflect the quantity of 2 AS SOON AS THE FIELD VALUE CHANGES".
        // This step previously attached evidence and asserted nothing, so the
        // procedure could never report the defect it is designated to
        // confirm — the store failing to recalculate was recorded as if it
        // were correct behaviour.
        expect
          .soft(
            recalculated,
            'TC-04-006 #3 expects the line total and the order total to recalculate as soon as the ' +
              'quantity field changes, before the value is committed. Confirms DEF-F4-02 when they do not.',
          )
          .toBe(true);
      });

      await test.step('TC-04-006 #4 — commit the quantity, totals show quantity 2', async () => {
        await cart.updateButton.click();
        await cart.goto();

        const aIdx = await lineIndexFor(CART_TEST_DATA.productA);
        const committedQty = await cart.lineQuantityInput(aIdx).inputValue();
        const lineTotal = (await cart.lineTotal(aIdx).textContent().catch(() => null))?.trim() ?? null;
        const orderTotal = (await cart.orderTotal.textContent().catch(() => null))?.trim() ?? null;

        await testInfo.attach('Committed quantity change — cart state', {
          body:
            `committed quantity: ${committedQty}\n` +
            `line total: ${lineTotal}\n` +
            `order total: ${orderTotal}\n` +
            `line count: ${await cart.lineCount()}`,
          contentType: 'text/plain',
        });

        expect.soft(committedQty, 'TC-04-006 #4 expects the committed quantity to be 2.').toBe('2');
        expect.soft(await cart.lineCount(), 'TC-04-006 #4 expects the cart to remain populated.').toBeGreaterThan(0);

        // TCS #4: "the line and order totals SHOW THE QUANTITY OF 2" — the
        // field reading 2 is not the same claim. Checked against the
        // quantity-1 line total recorded at #3 rather than a hardcoded price,
        // so it holds if the store's prices change (A-004).
        const singleUnit = parseMoney(lineTotalAtQty1);
        const committedLineTotal = parseMoney(lineTotal);
        if (!Number.isNaN(singleUnit) && !Number.isNaN(committedLineTotal)) {
          expect
            .soft(
              committedLineTotal,
              `TC-04-006 #4 expects the line total to show quantity 2 (2 x ${singleUnit} = ${2 * singleUnit}).`,
            )
            .toBeCloseTo(2 * singleUnit, 2);
        }
      });

      await test.step('TC-04-006 #5 — remove product A while B remains (state stays S2)', async () => {
        await cart.goto();
        const orderTotalBeforeRemoval = await readOrderTotal();
        await cart.removeLine(await lineIndexFor(CART_TEST_DATA.productA)).click();
        const removal = await checkLiveCartState('Remove product A', '(1)', 1);

        await testInfo.attach('Remove TD-04-A — order total recalculation', {
          body: `order total before removal: ${orderTotalBeforeRemoval}
order total after removal:  ${removal.orderTotalAfter}`,
          contentType: 'text/plain',
        });
        // TCS #5: "...and the order total recalculates without a manual refresh."
        expect
          .soft(removal.orderTotalAfter, 'TC-04-006 #5 expects the order total to recalculate once TD-04-A is removed.')
          .not.toBe(orderTotalBeforeRemoval);
      });

      await test.step('TC-04-006 #6 — add product A again (two lines present)', async () => {
        await product.goto(CART_TEST_DATA.productAHandle);
        const resp = page.waitForResponse((r) => r.url().includes('/cart/add'), { timeout: 10_000 }).catch(() => null);
        await product.addToCartButton.click();
        await resp;
        await checkLiveCartState('Re-add product A', '(2)', 2);
      });

      await test.step('TC-04-006 #7 — set quantity on product A to 0 while B remains (state stays S2)', async () => {
        await cart.goto();
        const orderTotalBeforeZero = await readOrderTotal();
        await cart.lineQuantityInput(await lineIndexFor(CART_TEST_DATA.productA)).fill('0');
        await cart.updateButton.click();
        const zeroed = await checkLiveCartState('Quantity 0 on product A', '(1)', 1);

        await testInfo.attach('Quantity 0 on TD-04-A — order total recalculation', {
          body: `order total before: ${orderTotalBeforeZero}
order total after:  ${zeroed.orderTotalAfter}`,
          contentType: 'text/plain',
        });
        // TCS #7: "...and the order total recalculates without a manual refresh."
        expect
          .soft(zeroed.orderTotalAfter, 'TC-04-006 #7 expects the order total to recalculate once TD-04-A is zeroed.')
          .not.toBe(orderTotalBeforeZero);
      });

      await test.step('TC-04-006 #8 — remove product B, the last remaining line (S2 -> S1)', async () => {
        await cart.goto();
        await cart.removeLine(await lineIndexFor(CART_TEST_DATA.productB)).click();
        await checkLiveCartState('Remove last line (B)', '(0)', 0);
      });

      await test.step('TC-04-006 #9 — add product A so one line is present (S1 -> S2)', async () => {
        await product.goto(CART_TEST_DATA.productAHandle);
        const resp = page.waitForResponse((r) => r.url().includes('/cart/add'), { timeout: 10_000 }).catch(() => null);
        await product.addToCartButton.click();
        await resp;
        await checkLiveCartState('Add product A (single line)', '(1)', 1);
      });

      await test.step('TC-04-006 #10 — set quantity on the last remaining line to 0 (S2 -> S1)', async () => {
        await cart.goto();
        await cart.lineQuantityInput(await lineIndexFor(CART_TEST_DATA.productA)).fill('0');
        await cart.updateButton.click();
        await checkLiveCartState('Quantity 0 on last remaining line', '(0)', 0);
      });

      await test.step('Wrap Up — confirm cart returns to empty state S1', async () => {
        await cart.goto();
        const remaining = await cart.lineCount();
        for (let i = remaining - 1; i >= 0; i--) {
          await cart.removeLine(i).click();
        }
        await cart.goto();
        expect(await cart.lineCount()).toBe(0);
        await header.gotoHome();
      });
    });
  });
});
