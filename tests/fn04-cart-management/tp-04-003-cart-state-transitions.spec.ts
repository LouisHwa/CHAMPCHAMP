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
 * EXPECTED TO FAIL, BY DESIGN — marked via test.fail() below. Confirmed
 * in the Defect Log: DEF-F4-01 (cart never updates in real time — a
 * manual refresh is required before a change appears) and DEF-F4-02 (the
 * quantity field's totals only update on Update-click/Enter, not
 * on-change). Each transition below checks the header cart count
 * immediately after the action, WITHOUT navigating — the TC expects it
 * to already reflect the change; per DEF-F4-01 it won't. A forced
 * reload afterward confirms the underlying state did change server-side,
 * so this is evidencing "not live," not "didn't happen."
 *
 * Wrapped in withFailureEvidence — test.fail() suppresses Playwright's
 * automatic failure capture, so this is what leaves evidence behind if
 * something unrelated (e.g. a Cloudflare interstitial) breaks the test
 * instead of DEF-F4-01/02.
 *
 * Intercase dependency: TP-04-001's zero-quantity removal step.
 */
test.describe('FN-04 Cart Management', () => {
  test('TP-04-003 cart state transitions', async ({ page }, testInfo) => {
    test.fail(true, 'Confirmed defects DEF-F4-01/DEF-F4-02: cart never reflects changes without a manual refresh.');

    const header = new HeaderBar(page);
    const product = new ProductPage(page);
    const cart = new CartPage(page);

    await withFailureEvidence(page, testInfo, async () => {
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

      await test.step('TC-04-006 #3 — change quantity on product A, commit', async () => {
        await cart.goto();
        await cart.lineQuantityInput(0).fill('2');
        await cart.updateButton.click();
        // No navigation here deliberately — checking whether totals reflect
        // the change without the reload the Update click itself triggers.
        const orderTotalText = await cart.orderTotal.textContent().catch(() => null);
        await testInfo.attach('Quantity change on product A — order total immediately after click', {
          body: `order total shown: ${orderTotalText}`,
          contentType: 'text/plain',
        });
      });

      await test.step('TC-04-006 #4 — remove product A while B remains (state stays S2)', async () => {
        await cart.goto();
        await cart.removeLine(0).click();
        await checkLiveCartCount('Remove product A', '(1)');
      });

      await test.step('TC-04-006 #5 — add product A again (two lines present)', async () => {
        await product.goto(CART_TEST_DATA.productAHandle);
        const resp = page.waitForResponse((r) => r.url().includes('/cart/add'), { timeout: 10_000 }).catch(() => null);
        await product.addToCartButton.click();
        await resp;
        await checkLiveCartCount('Re-add product A', '(2)');
      });

      await test.step('TC-04-006 #6 — set quantity on product A to 0 while B remains (state stays S2)', async () => {
        await cart.goto();
        const rows = await cart.lineCount();
        const aIndex = rows - 1; // most recently re-added
        await cart.lineQuantityInput(aIndex).fill('0');
        await cart.updateButton.click();
        await checkLiveCartCount('Quantity 0 on product A', '(1)');
      });

      await test.step('TC-04-006 #7 — remove product B, the last remaining line (S2 -> S1)', async () => {
        await cart.goto();
        await cart.removeLine(0).click();
        await checkLiveCartCount('Remove last line (B)', '(0)');
      });

      await test.step('TC-04-006 #8 — add product A so one line is present (S1 -> S2)', async () => {
        await product.goto(CART_TEST_DATA.productAHandle);
        const resp = page.waitForResponse((r) => r.url().includes('/cart/add'), { timeout: 10_000 }).catch(() => null);
        await product.addToCartButton.click();
        await resp;
        await checkLiveCartCount('Add product A (single line)', '(1)');
      });

      await test.step('TC-04-006 #9 — set quantity on the last remaining line to 0 (S2 -> S1)', async () => {
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
