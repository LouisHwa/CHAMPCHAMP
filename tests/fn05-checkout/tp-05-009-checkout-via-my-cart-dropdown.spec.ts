import { test, expect } from '@playwright/test';
import { HeaderBar } from '../../pages/HeaderBar';
import { CatalogPage } from '../../pages/CatalogPage';
import { ProductPage } from '../../pages/ProductPage';
import { CartDrawer } from '../../pages/CartDrawer';
import { CheckoutPage } from '../../pages/CheckoutPage';
import { recordUrl, withFailureEvidence } from '../../utils/evidence';

/**
 * TP-05-009 — Verify checkout reached through the My Cart dropdown
 * resolves to the same checkout page as the navigation route. Covers
 * TC-05-009 (#1, #2).
 *
 * EXPECTED TO FAIL, BY DESIGN — DEF-F4-01 ("Cart does not update in
 * real time; items only appear after a manual page refresh"). Confirmed
 * live (2026-08-07): the header's "My Cart (N)" badge updates
 * immediately after Add to Cart, but #drawer's own row markup is a
 * server-rendered snapshot from the page's initial load and does not
 * reflect that same-page AJAX add — the dropdown opens showing 0 lines.
 * This is the same defect CartDrawer.ts's stale-DOM warning documents
 * for FN-04, reproduced here in the FN-05 "checkout via dropdown" flow.
 */
test.describe('FN-05 Checkout', () => {
  test('TP-05-009 checkout via My Cart dropdown', async ({ page }, testInfo) => {
    test.setTimeout(60000);
    test.fail();
    const header = new HeaderBar(page);
    const catalog = new CatalogPage(page);
    const product = new ProductPage(page);
    const drawer = new CartDrawer(page);
    const checkout = new CheckoutPage(page);

    await test.step('Set Up — add a product to an empty cart', async () => {
      await header.gotoHome();
      await catalog.goto();
      await catalog.grid.locator('a').first().click();
      await page.waitForLoadState('domcontentloaded');
      if ((await product.sizeSelect.count()) > 0 && (await product.sizeSelect.locator('option').count()) > 1) {
        const value = await product.sizeSelect.locator('option').nth(1).getAttribute('value');
        if (value) await product.selectSize(value);
      }
      await product.addToCartButton.click();
      await page.waitForLoadState('networkidle').catch(() => {});
    });

    await withFailureEvidence(page, testInfo, 'TC-05-009 #1 dropdown shows added item (DEF-F4-01)', async () => {
      await test.step('TC-05-009 #1 — My Cart dropdown opens showing items and CHECK OUT', async () => {
        await header.cartToggle.click();
        await drawer.drawer.waitFor({ state: 'visible' });
        const url = await recordUrl(page, testInfo, 'Mini-cart dropdown opened');
        await testInfo.attach('Mini-cart dropdown line count', {
          body: `lines: ${await drawer.lineCount()} (header badge: ${await header.cartCount.textContent().catch(() => '(unreadable)')})`,
          contentType: 'text/plain',
        });

        expect(url).not.toContain('/cart');
        await expect(drawer.drawer).toBeVisible();
        expect(await drawer.lineCount()).toBeGreaterThan(0);
        await expect(drawer.checkoutButton).toBeVisible();
      });

      await test.step('TC-05-009 #2 — CHECK OUT reaches the same checkout page as the navigation route', async () => {
        await drawer.checkoutButton.click();
        await page.waitForLoadState('domcontentloaded');
        const url = await recordUrl(page, testInfo, 'Checkout reached via My Cart dropdown');

        expect(url).toContain('/checkouts/');
        await expect(checkout.costSummaryRow('Subtotal').first()).toBeVisible();
        await expect(checkout.costSummaryRow('Total').first()).toBeVisible();
        await expect(checkout.emailField).toBeVisible();
      });
    });
  });
});
