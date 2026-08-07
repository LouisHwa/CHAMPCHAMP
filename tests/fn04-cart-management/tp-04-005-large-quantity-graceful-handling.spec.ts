import { test, expect, Page } from '@playwright/test';
import { HeaderBar } from '../../pages/HeaderBar';
import { ProductPage } from '../../pages/ProductPage';
import { CartPage } from '../../pages/CartPage';
import { PRODUCT_HANDLES } from '../../fixtures/test-data';

/**
 * TP-04-005 — Verify large quantity input is handled without a page
 * crash, at and above the crash threshold. Covers TC-04-005 (#1 to #3).
 *
 * EXPECTED TO FAIL, BY DESIGN — marked via test.fail() below. Confirmed
 * in the Defect Log (DEF-F4-04, Major severity): quantity 1,000,000 is
 * handled fine, but 1,000,001 and above genuinely crash the cart page.
 * This is a real browser/page crash, not just an error message, so each
 * attempt is wrapped defensively (crash listener, try/catch, a fresh
 * page reference check) so a crash on one value doesn't take down the
 * rest of the test run. If the page is confirmed dead, remaining
 * attempts in that step are skipped rather than retried against it.
 *
 * Intercase dependency: TP-04-004's valid quantity acceptance step.
 */
test.describe('FN-04 Cart Management', () => {
  test('TP-04-005 large quantity graceful handling', async ({ page }, testInfo) => {
    test.fail(true, 'Confirmed defect DEF-F4-04: quantities above 1,000,000 crash the cart page.');
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

    await test.step('Set Up — confirm empty cart baseline', async () => {
      await cart.goto();
      expect(await cart.lineCount()).toBe(0);
      await header.gotoHome();
    });

    let pageIsDead = false;

    await test.step('Add a product to test large quantities against', async () => {
      try {
        await product.goto(PRODUCT_HANDLES.bronzeSandals);
        const cartAddResponse = page
          .waitForResponse((res) => res.url().includes('/cart/add'), { timeout: 10_000 })
          .catch(() => null);
        await product.addToCartButton.click();
        await cartAddResponse;
        await cart.goto();
        await testInfo.attach('Add product — result', {
          body: 'Product added successfully; proceeding to large-quantity checks.',
          contentType: 'text/plain',
        });
      } catch (error) {
        pageIsDead = true;
        await testInfo.attach('Add product — failed', {
          body: `Could not add the test product, so the large-quantity checks below could not run: ${(error as Error).message}`,
          contentType: 'text/plain',
        });
      }
    });

    for (const [stepLabel, qty] of [
      ['TC-04-005 #1', '1000000'],
      ['TC-04-005 #2', '1000001'],
      ['TC-04-005 #3', '5000000'],
    ] as const) {
      await test.step(`${stepLabel} — quantity ${qty}`, async () => {
        if (pageIsDead) {
          await testInfo.attach(`Quantity ${qty} — skipped`, {
            body: 'Skipped: either the page did not recover from a previous crash, or the test product could not be added in the first place.',
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

    await test.step('Wrap Up — empty the cart, reload the storefront', async () => {
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
