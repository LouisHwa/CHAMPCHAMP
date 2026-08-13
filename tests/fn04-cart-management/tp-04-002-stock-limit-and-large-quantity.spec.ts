import { test, expect } from '../../utils/pacedTest';
import type { Page } from '@playwright/test';
import { HeaderBar } from '../../pages/HeaderBar';
import { ProductPage } from '../../pages/ProductPage';
import { CartPage } from '../../pages/CartPage';
import { CART_TEST_DATA } from '../../fixtures/test-data';
import { captureCrashEvidence, withFailureEvidence } from '../../utils/evidence';

/**
 * TP-04-002 — Verify the cart line quantity is validated against
 * available stock at and either side of the stock limit, and that
 * large quantity input at and above the crash threshold is handled
 * without a page crash. Covers TC-04-004, TC-04-005 (merged per the
 * refined TPS FN-04).
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
 * Expected failures here confirm two defects:
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
 *     try/catch, dead-page check) and, if the page does not survive, the
 *     next value is attempted on a fresh page in the same context — so a
 *     crash on one value does not consume the rest. Before 13 August it
 *     did: the first crash set pageIsDead and every later value was
 *     recorded as "skipped", discharging no coverage.
 *
 *     1,000,000 is the boundary value that should PASS. It was failing
 *     for a reason of our own making — a hardcoded 10s cap on the /cart
 *     navigation inside attemptQuantity, against a suite
 *     navigationTimeout of 45s — which reported a late navigation as an
 *     unresponsive page. Confirmed by hand that 1,000,000 is handled
 *     fine. Do not "fix" a failure at this value by rebinding the test
 *     data downwards: it is the just-below-threshold half of the
 *     boundary pair with 1,000,001, and moving it stops the pair
 *     probing the threshold at all.
 *
 * Wrapped in withFailureEvidence so an unrelated breakage still leaves
 * a labelled screenshot and page text behind alongside Playwright's
 * own capture.
 *
 * Intercase dependency: TP-04-001's valid quantity acceptance step.
 */
test.describe('FN-04 Cart Management', () => {
  test('TP-04-002 stock limit and large quantity handling', async ({ page }, testInfo) => {
    test.setTimeout(90_000);

    const header = new HeaderBar(page);
    const product = new ProductPage(page);
    const cart = new CartPage(page);

    /**
     * responsive  — the store handled the commit without failing.
     * pageUsable  — the page can still be driven. A rendered error page
     *               can be; a crashed or closed one cannot. Kept separate
     *               so the loop only replaces the page when it must.
     * committed   — the quantity actually on the cart line afterwards, or
     *               null where it could not be read.
     */
    type QtyOutcome = {
      responsive: boolean;
      pageUsable: boolean;
      committed: string | null;
      detail: string;
    };

    async function attemptQuantity(target: Page, qty: string): Promise<QtyOutcome> {
      let crashed = false;
      const onCrash = () => {
        crashed = true;
      };
      target.on('crash', onCrash);

      // Go through CartPage rather than a raw locator. The store renders
      // the cart form TWICE on /cart — once in the hidden #drawer minicart
      // that sits in the header, once in #cart itself — and both copies
      // carry name="updates[]" AND the same id. #drawer comes first in DOM
      // order, so `locator('input[name="updates[]"]').first()` resolved to
      // the hidden copy and every fill timed out with "element is not
      // visible", leaving the quantity untouched. TC-04-005 then recorded
      // an unresponsive page when the store had never been sent the value
      // at all. CartPage.rows is scoped to '#cart .row' for exactly this
      // reason, which is why the earlier steps using it worked.
      const targetCart = new CartPage(target);

      try {
        // Start every boundary value from a freshly rendered /cart. Clicking
        // Update is a form POST that reloads the page, so each attempt would
        // otherwise inherit whatever DOM the previous commit left behind —
        // and each value is its own coverage item, so they must not depend
        // on each other's end state. Also gives the recovery path a loaded
        // page without needing to navigate separately.
        await target.goto('/cart', { waitUntil: 'domcontentloaded' });

        await targetCart.lineQuantityInput(0).fill(qty, { timeout: 10_000 });

        // SPR-14 evidence: show the value actually sitting in the field
        // before it is committed. Without this the report only ever shows
        // the aftermath, never the input that caused it.
        await testInfo
          .attach(`Quantity ${qty} — entered, before commit`, {
            body: await target.locator('#cart').screenshot({ timeout: 5_000 }),
            contentType: 'image/png',
          })
          .catch(() => {});

        await targetCart.updateButton.click({ timeout: 10_000 });
        await target.waitForTimeout(2_000);
        if (target.isClosed() || crashed) {
          await captureCrashEvidence(target, testInfo, `Quantity ${qty} — after commit (crashed)`);
          return {
            responsive: false,
            pageUsable: false,
            committed: null,
            detail: 'page crashed or closed after commit',
          };
        }

        // Shopify's failure page ("Something went wrong. / Cart Error") is a
        // SUCCESSFULLY RENDERED page, so neither page.on('crash') nor
        // isClosed() sees it — and the recovery navigation below would
        // reload a working /cart and erase it. Before this check, 1,000,001
        // and 5,000,000 both reported responsive: true with the quantity
        // silently still at 1,000,000: a false pass over DEF-F4-04, the
        // exact defect these steps exist to record. Detect it here, while
        // it is still on screen.
        const bodyText = await target.locator('body').innerText().catch(() => '');
        const errorMatch = bodyText.match(/cart error|something went wrong/i);
        if (errorMatch) {
          const summary = bodyText
            .split('\n')
            .map((l) => l.trim())
            .filter(Boolean)
            .slice(0, 6)
            .join(' | ');
          await captureCrashEvidence(target, testInfo, `Quantity ${qty} — store error page after commit`);
          return {
            responsive: false,
            pageUsable: true,
            committed: null,
            detail: `store returned an error page after commit (matched "${errorMatch[0]}") at ${target.url()} — page text: ${summary}`,
          };
        }
        // Inherit navigationTimeout (45s) rather than capping at 10s, and
        // use baseURL like every other navigation in the suite. The cap
        // was reporting a LATE navigation as an unresponsive page: this is
        // the heaviest /cart load here — Shopify recalculates a
        // £50,000,000 total right after the commit — and 20s was already
        // proven insufficient for a plain /cart navigation on 10 August
        // (see playwright.config.ts navigationTimeout). At 10s, quantity
        // 1,000,000 failed the responsiveness check even though it is
        // handled fine by hand, which reads in the Defect Log as DEF-F4-04
        // firing one value below its actual threshold.
        await target.goto('/cart', { waitUntil: 'domcontentloaded' });
        // lineCount() filters #cart .row to rows that actually contain a
        // quantity input — the totals summary div also carries .row and
        // would otherwise be counted as a line (see CartPage.ts).
        const rowCount = await targetCart.lineCount();
        const committed = await targetCart.lineQuantityInput(0).inputValue().catch(() => null);
        return {
          responsive: true,
          pageUsable: true,
          committed,
          detail: `page responsive; cart line count now ${rowCount}; quantity on the line: ${committed ?? '(unreadable)'}`,
        };
      } catch (error) {
        // The page stopped responding mid-interaction. Capture whatever
        // state it is in — a rendered error page, a frozen cart, or a
        // screenshot that cannot be taken at all.
        await captureCrashEvidence(target, testInfo, `Quantity ${qty} — unresponsive`);
        return {
          responsive: false,
          // A timeout or selector failure leaves the page perfectly
          // drivable; only a crash or a closed page does not.
          pageUsable: !target.isClosed() && !crashed,
          committed: null,
          detail: `error during interaction: ${(error as Error).message}`,
        };
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
        expect.soft(committedQty).toBe(String(CART_TEST_DATA.assumedStock));
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
      let target: Page = page;

      for (const [stepLabel, qty] of [
        ['TC-04-005 #1', '1000000'],
        ['TC-04-005 #2', '1000001'],
        ['TC-04-005 #3', '5000000'],
      ] as const) {
        await test.step(`${stepLabel} — quantity ${qty}`, async () => {
          // Recover rather than skip. Each boundary value is its own
          // coverage item, so a crash on one must not consume the rest —
          // previously 1,000,001 crashing left 5,000,000 recorded as
          // "skipped", which discharges nothing and reports a failure that
          // says nothing about the store. A new page in the SAME context
          // still sees the cart, because Shopify carries it in a cookie
          // rather than in the page.
          if (pageIsDead || target.isClosed()) {
            await testInfo.attach(`Quantity ${qty} — recovered on a fresh page`, {
              body:
                'The previous quantity left the page unresponsive. Reopened in the same browser ' +
                'context so this value is still exercised; the cart line survives the crash.',
              contentType: 'text/plain',
            });
            // attemptQuantity navigates to /cart itself, so no goto here.
            target = await page.context().newPage();
            pageIsDead = false;
          }

          const result = await attemptQuantity(target, qty);
          await testInfo.attach(`Quantity ${qty} — page responsiveness`, {
            body:
              `responsive: ${result.responsive}\n` +
              `quantity requested: ${qty}\n` +
              `quantity committed: ${result.committed ?? '(not committed)'}\n` +
              `committed value matches requested: ${result.committed === qty}\n` +
              `detail: ${result.detail}`,
            contentType: 'text/plain',
          });
          // Only a crash or a closed page needs a replacement page; an
          // error page is still drivable, and attemptQuantity re-navigates
          // to /cart at the start of the next attempt anyway.
          if (!result.pageUsable) pageIsDead = true;

          expect
            .soft(result.responsive, `TC-04-005 expects quantity ${qty} to be handled without the store failing.`)
            .toBe(true);
          // The second half of the false pass this step used to produce:
          // the store rendered an error page and kept the PREVIOUS
          // quantity, and nothing compared what was committed against what
          // was requested, so a silently discarded value read as a pass.
          expect
            .soft(
              result.committed,
              `TC-04-005 expects quantity ${qty} to reach the cart line, or to be refused with a message — not silently discarded.`,
            )
            .toBe(qty);
        });
      }

      await test.step('Wrap Up — remove the test product, return to baseline', async () => {
        // A crashed page used to skip cleanup entirely, leaving the
        // large-quantity line in the cart. Every other procedure's Set Up
        // hard-asserts an empty cart, so the next run would fail in its own
        // Set Up for a reason that has nothing to do with it. Clean up
        // through a live page instead — the cart is context state, so a
        // fresh page can still empty it.
        if (pageIsDead || target.isClosed()) {
          target = await page.context().newPage();
          await testInfo.attach('Wrap Up', {
            body: 'Previous page was unresponsive; cleaning up on a fresh page in the same context so the cart is returned to baseline for the next procedure.',
            contentType: 'text/plain',
          });
        }
        const liveCart = new CartPage(target);
        await liveCart.goto();
        const remaining = await liveCart.lineCount();
        for (let i = remaining - 1; i >= 0; i--) {
          await liveCart.removeLine(i).click();
        }
        await new HeaderBar(target).gotoHome();
      });
    });
  });
});
