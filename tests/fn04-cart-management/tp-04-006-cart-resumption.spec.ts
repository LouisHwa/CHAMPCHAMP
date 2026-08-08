import { test, expect } from '../../utils/pacedTest';
import { HeaderBar } from '../../pages/HeaderBar';
import { ProductPage } from '../../pages/ProductPage';
import { CartPage } from '../../pages/CartPage';
import { CART_TEST_DATA } from '../../fixtures/test-data';

/**
 * TP-04-006 — Verify a signed-in cart resumes on a second browser or
 * device, that a guest cart resumes in the same browser across
 * sessions, and that a signed-in cart resumes in the same browser
 * across sessions. Covers TC-04-011, TC-04-012, TC-04-013 — brand new,
 * no prior equivalent existed before the refined TPS FN-04.
 *
 * SIGN-IN SUBSTITUTION: every place the TC literally says "sign in,"
 * that action is not automatable — the login form is hCaptcha-protected
 * and rejects any Playwright-driven browser regardless of pacing,
 * confirmed all session (see auth-setup-guide.md). Per instruction,
 * this uses the transplanted session at playwright/.auth/user.json
 * (`browser.newContext({ storageState })`, the same pattern proven in
 * tests/_infra/auth-session.spec.ts) to START a context already signed
 * in wherever "sign in" is the required end state, rather than
 * performing the login. Signing OUT stays a real, live action
 * (HeaderBar.logOutLink) since it needs no captcha.
 *
 * This test needs a real, freshly captured playwright/.auth/user.json
 * to run at all — see auth-setup-guide.md. Manually creates every
 * context itself (rather than using the default page/context fixture)
 * because TC-04-012 needs a genuinely signed-out context in the middle
 * of the same test, which a single file-level test.use({ storageState })
 * can't express. baseURL is passed explicitly to every newContext()
 * call for the same reason — it's only implicit on the fixture-provided
 * context, not on manually created ones.
 *
 * "Close and reopen the browser" is simulated by capturing
 * context.storageState() before closing and handing that snapshot to
 * the next newContext() — the only way Playwright can carry live
 * cookies/localStorage across a context boundary, since a closed
 * context's state isn't kept around implicitly.
 */
const STORAGE_STATE_PATH = 'playwright/.auth/user.json';
const BASE_URL = 'https://sauce-demo.myshopify.com';

test.describe('FN-04 Cart Management', () => {
  test('TP-04-006 cart resumption across sessions', async ({ browser }, testInfo) => {
    test.setTimeout(120_000);

    async function readCart(page: import('@playwright/test').Page) {
      const cart = new CartPage(page);
      await cart.goto();
      const lineCount = await cart.lineCount();
      const orderTotal = lineCount > 0 ? (await cart.orderTotal.textContent())?.trim() ?? '' : '£0.00';
      return { lineCount, orderTotal };
    }

    // ---------------------------------------------------------------
    // TC-04-011 — signed-in cart resumes on a second browser
    // ---------------------------------------------------------------
    const contextA1 = await browser.newContext({ baseURL: BASE_URL, storageState: STORAGE_STATE_PATH });
    const pageA1 = await contextA1.newPage();
    const headerA1 = new HeaderBar(pageA1);
    const productA1 = new ProductPage(pageA1);

    let browserACartAfterAdd: { lineCount: number; orderTotal: string } = { lineCount: 0, orderTotal: '' };

    await test.step('TC-04-011 #1 — Browser A starts signed in (sign-in substituted per the note above)', async () => {
      await pageA1.goto('/account', { waitUntil: 'domcontentloaded' });
      expect(pageA1.url()).not.toContain('/account/login');
      await expect(headerA1.logOutLink).toBeVisible();
    });

    await test.step('TC-04-011 #2 — add products, record cart lines and order total', async () => {
      await productA1.goto(CART_TEST_DATA.productAHandle);
      const resp = pageA1.waitForResponse((r) => r.url().includes('/cart/add'), { timeout: 10_000 }).catch(() => null);
      await productA1.addToCartButton.click();
      await resp;

      browserACartAfterAdd = await readCart(pageA1);
      await testInfo.attach('Browser A — cart after add', {
        body: `line count: ${browserACartAfterAdd.lineCount}\norder total: ${browserACartAfterAdd.orderTotal}`,
        contentType: 'text/plain',
      });
      expect(browserACartAfterAdd.lineCount).toBeGreaterThan(0);
    });

    await test.step('TC-04-011 #3 — sign out on Browser A (real, automatable action)', async () => {
      await headerA1.logOutLink.click();
      await pageA1.waitForLoadState('domcontentloaded');
      await expect(headerA1.logInLink).toBeVisible();
    });

    await contextA1.close();

    await test.step('TC-04-011 #4 — Browser B, also starting signed in to the same account, shows the same cart', async () => {
      const contextB = await browser.newContext({ baseURL: BASE_URL, storageState: STORAGE_STATE_PATH });
      const pageB = await contextB.newPage();
      const browserBCart = await readCart(pageB);

      await testInfo.attach('Browser B — cart contents (same account)', {
        body: `line count: ${browserBCart.lineCount}\norder total: ${browserBCart.orderTotal}\ncompared against Browser A: ${browserACartAfterAdd.lineCount} lines / ${browserACartAfterAdd.orderTotal}`,
        contentType: 'text/plain',
      });
      expect(browserBCart.lineCount).toBe(browserACartAfterAdd.lineCount);
      expect(browserBCart.orderTotal).toBe(browserACartAfterAdd.orderTotal);

      // Empty the account cart before the next test case (ENV-08 reset — no coverage of its own).
      const cartB = new CartPage(pageB);
      const remaining = await cartB.lineCount();
      for (let i = remaining - 1; i >= 0; i--) {
        await cartB.removeLine(i).click();
      }
      await headerA1.logOutLink.click().catch(() => {}); // best-effort; contextB may already be signed out server-side
      await contextB.close();
    });

    // ---------------------------------------------------------------
    // TC-04-012 — guest cart resumes in the same browser across a close/reopen
    // ---------------------------------------------------------------
    let guestContext = await browser.newContext({ baseURL: BASE_URL });
    let guestPage = await guestContext.newPage();
    let guestProduct = new ProductPage(guestPage);
    let guestCartAfterAdd: { lineCount: number; orderTotal: string } = { lineCount: 0, orderTotal: '' };

    await test.step('TC-04-012 #1 — Browser A, without signing in, adds products and shows them', async () => {
      await guestProduct.goto(CART_TEST_DATA.productAHandle);
      const resp = guestPage.waitForResponse((r) => r.url().includes('/cart/add'), { timeout: 10_000 }).catch(() => null);
      await guestProduct.addToCartButton.click();
      await resp;

      guestCartAfterAdd = await readCart(guestPage);
      await testInfo.attach('Guest Browser A — cart after add', {
        body: `line count: ${guestCartAfterAdd.lineCount}\norder total: ${guestCartAfterAdd.orderTotal}`,
        contentType: 'text/plain',
      });
      expect(guestCartAfterAdd.lineCount).toBeGreaterThan(0);
    });

    let guestSnapshot: Awaited<ReturnType<typeof guestContext.storageState>>;

    await test.step('TC-04-012 #2 — end the session by closing Browser A, without clearing storage', async () => {
      // Capturing the live storageState before close is the only way to
      // carry cookies/localStorage across a context boundary — this is
      // the "don't clear storage" instruction's Playwright equivalent.
      guestSnapshot = await guestContext.storageState();
      await guestContext.close();
      expect(guestContext.pages().length).toBe(0);
    });

    await test.step('TC-04-012 #3 — reopen Browser A, still signed out, cart is unchanged', async () => {
      const reopenedContext = await browser.newContext({ baseURL: BASE_URL, storageState: guestSnapshot });
      const reopenedPage = await reopenedContext.newPage();
      const reopenedHeader = new HeaderBar(reopenedPage);

      await reopenedPage.goto('/', { waitUntil: 'domcontentloaded' });
      await expect(reopenedHeader.logInLink).toBeVisible();

      const reopenedCart = await readCart(reopenedPage);
      await testInfo.attach('Guest Browser A — cart after reopen', {
        body: `line count: ${reopenedCart.lineCount}\norder total: ${reopenedCart.orderTotal}\ncompared against pre-close: ${guestCartAfterAdd.lineCount} lines / ${guestCartAfterAdd.orderTotal}`,
        contentType: 'text/plain',
      });
      expect(reopenedCart.lineCount).toBe(guestCartAfterAdd.lineCount);
      expect(reopenedCart.orderTotal).toBe(guestCartAfterAdd.orderTotal);

      // Empty the guest cart before the next test case (ENV-08 reset — no coverage of its own).
      const cart = new CartPage(reopenedPage);
      const remaining = await cart.lineCount();
      for (let i = remaining - 1; i >= 0; i--) {
        await cart.removeLine(i).click();
      }
      await reopenedContext.close();
    });

    // ---------------------------------------------------------------
    // TC-04-013 — signed-in cart resumes in the same browser across a close/reopen
    // ---------------------------------------------------------------
    const contextA2 = await browser.newContext({ baseURL: BASE_URL, storageState: STORAGE_STATE_PATH });
    const pageA2 = await contextA2.newPage();
    const headerA2 = new HeaderBar(pageA2);
    const productA2 = new ProductPage(pageA2);
    let signedInCartAfterAdd: { lineCount: number; orderTotal: string } = { lineCount: 0, orderTotal: '' };

    await test.step('TC-04-013 #1 — Browser A starts signed in, adds products and shows them', async () => {
      await pageA2.goto('/account', { waitUntil: 'domcontentloaded' });
      expect(pageA2.url()).not.toContain('/account/login');

      await productA2.goto(CART_TEST_DATA.productAHandle);
      const resp = pageA2.waitForResponse((r) => r.url().includes('/cart/add'), { timeout: 10_000 }).catch(() => null);
      await productA2.addToCartButton.click();
      await resp;

      signedInCartAfterAdd = await readCart(pageA2);
      await testInfo.attach('Signed-in Browser A — cart after add', {
        body: `line count: ${signedInCartAfterAdd.lineCount}\norder total: ${signedInCartAfterAdd.orderTotal}`,
        contentType: 'text/plain',
      });
      expect(signedInCartAfterAdd.lineCount).toBeGreaterThan(0);
    });

    await test.step('TC-04-013 #2 — sign out, then close Browser A', async () => {
      await headerA2.logOutLink.click();
      await pageA2.waitForLoadState('domcontentloaded');
      await expect(headerA2.logInLink).toBeVisible();
      await contextA2.close();
      expect(contextA2.pages().length).toBe(0);
    });

    await test.step('TC-04-013 #3 — reopen Browser A, sign in to the same account again, cart is unchanged', async () => {
      // Re-signing-in is the same substitution as TC-04-011 #1 — a fresh
      // context loading the persistent auth file again, not the
      // just-closed (now signed-out) snapshot from the previous step.
      const reopenedContext = await browser.newContext({ baseURL: BASE_URL, storageState: STORAGE_STATE_PATH });
      const reopenedPage = await reopenedContext.newPage();

      const reopenedCart = await readCart(reopenedPage);
      await testInfo.attach('Signed-in Browser A — cart after reopen and re-sign-in', {
        body: `line count: ${reopenedCart.lineCount}\norder total: ${reopenedCart.orderTotal}\ncompared against pre-close: ${signedInCartAfterAdd.lineCount} lines / ${signedInCartAfterAdd.orderTotal}`,
        contentType: 'text/plain',
      });
      expect(reopenedCart.lineCount).toBe(signedInCartAfterAdd.lineCount);
      expect(reopenedCart.orderTotal).toBe(signedInCartAfterAdd.orderTotal);

      // Wrap Up — empty the account cart, sign out.
      const cart = new CartPage(reopenedPage);
      const remaining = await cart.lineCount();
      for (let i = remaining - 1; i >= 0; i--) {
        await cart.removeLine(i).click();
      }
      const header = new HeaderBar(reopenedPage);
      await header.logOutLink.click().catch(() => {});
      await reopenedContext.close();
    });
  });
});
