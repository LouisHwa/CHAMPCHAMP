import { test, expect } from '../../utils/pacedTest';
import { HeaderBar } from '../../pages/HeaderBar';
import { CatalogPage } from '../../pages/CatalogPage';
import { ProductPage } from '../../pages/ProductPage';
import { CartPage } from '../../pages/CartPage';
import { CheckoutPage } from '../../pages/CheckoutPage';
import { startSignedInContext } from './_helpers';
import { recordUrl } from '../../utils/evidence';

/**
 * TP-05-001 — Verify checkout can be entered both without an account
 * and with a signed-in account. Covers TC-05-001 (#1, #2).
 *
 * SIGN-IN SUBSTITUTION: the second phase's "sign in" is not a live
 * action — the login form is hCaptcha-protected and rejects any
 * Playwright-driven browser regardless of pacing, confirmed all
 * session (see auth-setup-guide.md). Per instruction, this starts a
 * second context already signed in via the transplanted session at
 * playwright/.auth/user.json (startSignedInContext, the same pattern
 * proven on fn04-cart-management's TP-04-006) rather than performing
 * the login. Needs a real, freshly captured session file to run.
 *
 * No payment is entered and no order is completed by this procedure —
 * that's covered by TP-05-005 (guest) and TP-05-006 (signed-in).
 */
test.describe('FN-05 Checkout', () => {
  test('TP-05-001 checkout entry', async ({ page, browser }, testInfo) => {
    const header = new HeaderBar(page);
    const catalog = new CatalogPage(page);
    const product = new ProductPage(page);
    const cart = new CartPage(page);
    const checkout = new CheckoutPage(page);

    async function addProductAndReachCheckout(p: typeof page, prod: ProductPage, c: CartPage) {
      await catalog.goto();
      await catalog.grid.locator('a').first().click();
      await p.waitForLoadState('domcontentloaded');
      if ((await prod.sizeSelect.count()) > 0 && (await prod.sizeSelect.locator('option').count()) > 1) {
        const value = await prod.sizeSelect.locator('option').nth(1).getAttribute('value');
        if (value) await prod.selectSize(value);
      }
      await prod.addToCartButton.click();
      await p.waitForLoadState('networkidle').catch(() => {});
      await c.goto();
      await c.checkoutButton.click();
      await p.waitForLoadState('domcontentloaded');
    }

    await test.step('Set Up — confirm empty cart baseline, not signed in', async () => {
      await header.gotoHome();
      await cart.goto();
      expect(await cart.lineCount()).toBe(0);
      await expect(header.logInLink).toBeVisible();
    });

    await test.step('TC-05-001 #1 — guest checkout entry, Contact section offers guest entry', async () => {
      await addProductAndReachCheckout(page, product, cart);
      const url = await recordUrl(page, testInfo, 'Guest checkout entry');

      expect(url).toContain('/checkouts/');
      await expect(checkout.emailField).toBeVisible();
      await expect(checkout.signInLink).toBeVisible();
    });

    await test.step('Reset — return to store, empty cart before the signed-in route', async () => {
      await header.gotoHome();
      await cart.goto();
      const remaining = await cart.lineCount();
      for (let i = remaining - 1; i >= 0; i--) {
        await cart.removeLine(i).click();
      }
      await cart.goto();
      expect(await cart.lineCount()).toBe(0);
    });

    const signedIn = await startSignedInContext(browser);

    await test.step('TC-05-001 #2 — signed-in checkout entry, checkout opens for the signed-in shopper', async () => {
      await signedIn.page.goto('/account', { waitUntil: 'domcontentloaded' });
      expect(signedIn.page.url()).not.toContain('/account/login');

      await addProductAndReachCheckout(signedIn.page, signedIn.product, signedIn.cart);
      const url = await recordUrl(signedIn.page, testInfo, 'Signed-in checkout entry');

      expect(url).toContain('/checkouts/');
      // Signed in: the Contact section has already resolved the account,
      // so the guest "Sign in" prompt is not offered the way it is in
      // the guest route above.
      await expect(signedIn.checkout.signInLink).not.toBeVisible();
    });

    await test.step('Wrap Up — empty cart and sign out (signed-in context), return home', async () => {
      await signedIn.cart.goto();
      const remaining = await signedIn.cart.lineCount();
      for (let i = remaining - 1; i >= 0; i--) {
        await signedIn.cart.removeLine(i).click();
      }
      await signedIn.header.gotoHome();
      await signedIn.header.logOutLink.click().catch(() => {});
      await signedIn.context.close();

      await header.gotoHome();
    });
  });
});
