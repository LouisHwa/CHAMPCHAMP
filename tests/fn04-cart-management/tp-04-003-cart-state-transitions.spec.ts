import { test, expect } from '../../utils/pacedTest';
import { HeaderBar } from '../../pages/HeaderBar';
import { ProductPage } from '../../pages/ProductPage';
import { CartPage } from '../../pages/CartPage';
import { CART_TEST_DATA } from '../../fixtures/test-data';
import { withFailureEvidence } from '../../utils/evidence';

/**
 * TP-04-003 — Verify the cart transitions from empty through populated
 * and back to empty, with totals recalculated on each change and the
 * cart icon and contents updated without a manual refresh. Covers
 * TC-04-006 (#1 to #9), renumbered from the old TP-04-006 per the
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
 * on-change). Each transition below checks the header cart count
 * immediately after the action, WITHOUT navigating — the TC expects it
 * to already reflect the change; per DEF-F4-01 it won't. A forced
 * reload afterward confirms the underlying state did change server-side,
 * so this is evidencing "not live," not "didn't happen."
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

      async function checkLiveCartCount(label: string, expectedCount: string) {
        const liveText = await header.cartCount.textContent();
        await cart.goto();
        const actualLineCount = await cart.lineCount();
        await testInfo.attach(`${label} — live vs reloaded state`, {
          body: `header count shown without reload: ${liveText}\nexpected: (${expectedCount})\nactual line count after reload: ${actualLineCount}`,
          contentType: 'text/plain',
        });
        expect.soft(liveText?.trim(), `${label}: header cart count should already read ${expectedCount} without a reload.`).toBe(expectedCount);
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
        await checkLiveCartCount('Add product A', '(1)');
      });

      await test.step('TC-04-006 #2 — add product B, a distinct product (line count 2)', async () => {
        await product.goto(CART_TEST_DATA.productBHandle);
        const resp = page.waitForResponse((r) => r.url().includes('/cart/add'), { timeout: 10_000 }).catch(() => null);
        await product.addToCartButton.click();
        await resp;
        await checkLiveCartCount('Add product B', '(2)');
      });

      await test.step('TC-04-006 #3 — change quantity on product A to 2 WITHOUT committing', async () => {
        await cart.goto();
        const aIndex = await lineIndexFor(CART_TEST_DATA.productA);

        const lineTotalBefore = (await cart.lineTotal(aIndex).textContent().catch(() => null))?.trim() ?? null;
        const orderTotalBefore = (await cart.orderTotal.textContent().catch(() => null))?.trim() ?? null;

        // Deliberately no Update click: the refined TPS separates changing
        // the field from committing it, and this step asks only whether the
        // totals recalculate as soon as the field value changes. Under
        // SPR-13 a value typed but not committed is not a submitted
        // quantity, so a total that moved here would be the finding.
        await cart.lineQuantityInput(aIndex).fill('2');
        await page.waitForTimeout(1_000);

        const lineTotalAfter = (await cart.lineTotal(aIndex).textContent().catch(() => null))?.trim() ?? null;
        const orderTotalAfter = (await cart.orderTotal.textContent().catch(() => null))?.trim() ?? null;

        await testInfo.attach('Uncommitted quantity change — totals before and after the field edit', {
          body:
            `quantity field set to: 2 (NOT committed)\n` +
            `line total  before: ${lineTotalBefore}   after: ${lineTotalAfter}\n` +
            `order total before: ${orderTotalBefore}   after: ${orderTotalAfter}\n` +
            `recalculated on field change alone: ${lineTotalBefore !== lineTotalAfter || orderTotalBefore !== orderTotalAfter}`,
          contentType: 'text/plain',
        });
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
        expect.soft(await cart.lineCount()).toBeGreaterThan(0);
      });

      await test.step('TC-04-006 #5 — remove product A while B remains (state stays S2)', async () => {
        await cart.goto();
        await cart.removeLine(await lineIndexFor(CART_TEST_DATA.productA)).click();
        await checkLiveCartCount('Remove product A', '(1)');
      });

      await test.step('TC-04-006 #6 — add product A again (two lines present)', async () => {
        await product.goto(CART_TEST_DATA.productAHandle);
        const resp = page.waitForResponse((r) => r.url().includes('/cart/add'), { timeout: 10_000 }).catch(() => null);
        await product.addToCartButton.click();
        await resp;
        await checkLiveCartCount('Re-add product A', '(2)');
      });

      await test.step('TC-04-006 #7 — set quantity on product A to 0 while B remains (state stays S2)', async () => {
        await cart.goto();
        await cart.lineQuantityInput(await lineIndexFor(CART_TEST_DATA.productA)).fill('0');
        await cart.updateButton.click();
        await checkLiveCartCount('Quantity 0 on product A', '(1)');
      });

      await test.step('TC-04-006 #8 — remove product B, the last remaining line (S2 -> S1)', async () => {
        await cart.goto();
        await cart.removeLine(await lineIndexFor(CART_TEST_DATA.productB)).click();
        await checkLiveCartCount('Remove last line (B)', '(0)');
      });

      await test.step('TC-04-006 #9 — add product A so one line is present (S1 -> S2)', async () => {
        await product.goto(CART_TEST_DATA.productAHandle);
        const resp = page.waitForResponse((r) => r.url().includes('/cart/add'), { timeout: 10_000 }).catch(() => null);
        await product.addToCartButton.click();
        await resp;
        await checkLiveCartCount('Add product A (single line)', '(1)');
      });

      await test.step('TC-04-006 #10 — set quantity on the last remaining line to 0 (S2 -> S1)', async () => {
        await cart.goto();
        await cart.lineQuantityInput(0).fill('0');
        await cart.updateButton.click();
        await checkLiveCartCount('Quantity 0 on last remaining line', '(0)');
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
