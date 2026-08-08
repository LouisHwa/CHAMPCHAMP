import { test, expect } from '../../utils/pacedTest';
import type { Page } from '@playwright/test';
import { HeaderBar } from '../../pages/HeaderBar';
import { ProductPage } from '../../pages/ProductPage';
import { CartPage } from '../../pages/CartPage';
import { CART_TEST_DATA } from '../../fixtures/test-data';
import { withFailureEvidence } from '../../utils/evidence';

/**
 * TP-04-002 — Verify the cart line quantity is validated against
 * available stock at and either side of the stock limit, and that
 * large quantity input at and above the crash threshold is handled
 * without a page crash. Covers TC-04-004, TC-04-005 (merged per the
 * refined TPS FN-04).
 *
 * EXPECTED TO FAIL, BY DESIGN — marked via test.fail() below. Two
 * confirmed defects apply:
 *   DEF-F4-05 — no stock quantity is ever shown on product pages, and
 *     the store accepts any quantity with no inventory limit at all.
 *     TC-04-004's own premise (recording stock S, then testing S and
 *     S+1) is adapted to prove that absence directly, using
 *     CART_TEST_DATA.assumedStock (TD-04-S = 10) as the assumed S per
 *     the TPS's own instruction to carry it as an assumption rather
 *     than read it from the page.
 *   DEF-F4-04 (Major) — quantity 1,000,000 is handled fine, but
 *     1,000,001 and above genuinely crash the cart page. Each large-
 *     quantity attempt is wrapped defensively (crash listener,
 *     try/catch, dead-page check) so a crash on one value doesn't take
 *     down the rest of the test, reusing the same helper proven for
 *     this defect previously.
 *
 * Wrapped in withFailureEvidence — test.fail() suppresses Playwright's
 * automatic failure capture, so this is what leaves evidence behind if
 * something unrelated (e.g. a Cloudflare interstitial) breaks the test
 * instead of DEF-F4-05/DEF-F4-04 themselves.
 *
 * Intercase dependency: TP-04-001's valid quantity acceptance step.
 */
test.describe('FN-04 Cart Management', () => {
  test('TP-04-002 stock limit and large quantity handling', async ({ page }, testInfo) => {
    test.fail(true, 'Confirmed defects DEF-F4-05/DEF-F4-04: no real stock limit is ever enforced, and quantities above 1,000,000 crash the cart page.');
    test.setTimeout(90_000);

    const header = new HeaderBar(page);
    const product = new ProductPage(page);
    const cart = new CartPage(page);

    async function attemptQuantity(target: Page, qty: string): Promise<{ responsive: boolean; detail: string }> {
      let crashed = false;
      const onCrash = () => {
        crashed = true;
      };
      target.on('crash', onCrash);
      try {
        await target.locator('input[name="updates[]"]').first().fill(qty, { timeout: 10_000 });
        await target.locator('#update').click({ timeout: 10_000 });
        await target.waitForTimeout(2_000);
        if (target.isClosed() || crashed) {
          return { responsive: false, detail: 'page crashed or closed after commit' };
        }
        await target.goto('https://sauce-demo.myshopify.com/cart', { waitUntil: 'domcontentloaded', timeout: 10_000 });
        const rowCount = await target.locator('#cart .row').count();
        return { responsive: true, detail: `page responsive; #cart .row count now ${rowCount}` };
      } catch (error) {
        return { responsive: false, detail: `error during interaction: ${(error as Error).message}` };
      } finally {
        target.off('crash', onCrash);
      }
    }

    await withFailureEvidence(page, testInfo, async () => {
      await test.step('Set Up — confirm empty cart baseline', async () => {
        await cart.goto();
        expect(await cart.lineCount()).toBe(0);
        await header.gotoHome();
      });

      await test.step('TC-04-004 #1 — look for a displayed stock quantity on the PDP', async () => {
        await product.goto(CART_TEST_DATA.productAHandle);
        const stockIndicator = page.locator('#buy').getByText(/\d+\s*(in stock|available|left)/i);
        const stockShown = await stockIndicator.isVisible().catch(() => false);
        await testInfo.attach('Stock quantity displayed on PDP', {
          body: `stock indicator visible: ${stockShown}`,
          contentType: 'text/plain',
        });
        // Soft, not hard: the remaining sub-checks still need to run and
        // attach their own evidence even though this one is already
        // known to fail — a hard expect() here would abort the test
        // before the boundary checks are ever attempted.
        expect.soft(stockShown, 'TC-04-004 expects a stock quantity S to be displayed on the PDP.').toBe(true);
      });

      await test.step('TC-04-004 #2 — quantity at assumed stock (S) is accepted', async () => {
        const cartAddResponse = page
          .waitForResponse((res) => res.url().includes('/cart/add'), { timeout: 10_000 })
          .catch(() => null);
        await product.addToCartButton.click();
        await cartAddResponse;
        await cart.goto();

        await cart.lineQuantityInput(0).fill(String(CART_TEST_DATA.assumedStock));
        await cart.updateButton.click();
        await cart.goto();

        const committedQty = await cart.lineQuantityInput(0).inputValue();
        await testInfo.attach(`Quantity ${CART_TEST_DATA.assumedStock} (assumed S) — acceptance`, {
          body: `committed quantity: ${committedQty}`,
          contentType: 'text/plain',
        });
        expect(committedQty).toBe(String(CART_TEST_DATA.assumedStock));
      });

      await test.step('TC-04-004 #3 — quantity S+1 expected refused, reverting to S', async () => {
        const overStock = CART_TEST_DATA.assumedStock + 1;
        await cart.lineQuantityInput(0).fill(String(overStock));
        await cart.updateButton.click();
        await cart.goto();

        const refusalMessage = page.locator('#cart .error, #cart .message, #cart [class*="error"]');
        const refused = (await refusalMessage.count()) > 0;
        const committedQty = await cart.lineQuantityInput(0).inputValue();
        await testInfo.attach(`Quantity ${overStock} (S+1) — refusal`, {
          body: `refusal message shown: ${refused}\nquantity field value after commit: ${committedQty} (expected to remain ${CART_TEST_DATA.assumedStock})`,
          contentType: 'text/plain',
        });

        expect.soft(refused, `TC-04-004 expects quantity ${overStock} to be refused as exceeding stock.`).toBe(true);
        expect.soft(committedQty, `TC-04-004 expects the quantity to remain at ${CART_TEST_DATA.assumedStock} after refusal.`).toBe(String(CART_TEST_DATA.assumedStock));
      });

      await test.step('TC-04-004 #4 — quantity 999 expected refused, reverting to S', async () => {
        await cart.lineQuantityInput(0).fill('999');
        await cart.updateButton.click();
        await cart.goto();

        const refusalMessage = page.locator('#cart .error, #cart .message, #cart [class*="error"]');
        const refused = (await refusalMessage.count()) > 0;
        const committedQty = await cart.lineQuantityInput(0).inputValue();
        await testInfo.attach('Quantity 999 — refusal', {
          body: `refusal message shown: ${refused}\nquantity field value after commit: ${committedQty} (expected to remain ${CART_TEST_DATA.assumedStock})`,
          contentType: 'text/plain',
        });

        expect.soft(refused, 'TC-04-004 expects quantity 999 to be refused as exceeding stock.').toBe(true);
        expect.soft(committedQty, `TC-04-004 expects the quantity to remain at ${CART_TEST_DATA.assumedStock} after refusal.`).toBe(String(CART_TEST_DATA.assumedStock));
      });

      let pageIsDead = false;

      for (const [stepLabel, qty] of [
        ['TC-04-005 #1', '1000000'],
        ['TC-04-005 #2', '1000001'],
        ['TC-04-005 #3', '5000000'],
      ] as const) {
        await test.step(`${stepLabel} — quantity ${qty}`, async () => {
          if (pageIsDead) {
            await testInfo.attach(`Quantity ${qty} — skipped`, {
              body: 'Skipped: the page did not recover from a previous crash.',
              contentType: 'text/plain',
            });
            expect.soft(false, `Skipped quantity ${qty} because a previous step in this test failed.`).toBe(true);
            return;
          }

          const result = await attemptQuantity(page, qty);
          await testInfo.attach(`Quantity ${qty} — page responsiveness`, {
            body: `responsive: ${result.responsive}\ndetail: ${result.detail}`,
            contentType: 'text/plain',
          });
          if (!result.responsive) pageIsDead = true;

          expect.soft(result.responsive, `TC-04-005 expects the page to remain responsive at quantity ${qty}.`).toBe(true);
        });
      }

      await test.step('Wrap Up — remove the test product, return to baseline', async () => {
        if (pageIsDead) {
          await testInfo.attach('Wrap Up', {
            body: 'Page did not recover from a crash; cleanup relies on a fresh context on the next test run rather than this one.',
            contentType: 'text/plain',
          });
          return;
        }
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
