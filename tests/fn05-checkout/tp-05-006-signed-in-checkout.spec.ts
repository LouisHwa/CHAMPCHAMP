import { test, expect } from '../../utils/pacedTest';
import { ConfirmationPage } from '../../pages/ConfirmationPage';
import { MyAccountPage } from '../../pages/MyAccountPage';
import {
  startSignedInContext,
  fillDeliveryAddress,
  fillCard,
  TEST_CARDS,
  NAME_ON_CARD,
  SIMULATION_VALUES,
  recordSimulationValue,
} from './_helpers';
import { recordUrl } from '../../utils/evidence';

/**
 * TP-05-006 — Verify a signed-in shopper can complete checkout and the
 * order is associated with the account. Covers TC-05-010 — brand new
 * build (previously excluded: signing in was a live-action blocker).
 *
 * SIGN-IN SUBSTITUTION: "sign in from the Contact section" is not a
 * live action here — the login form is hCaptcha-protected regardless
 * of entry point, confirmed all session (see auth-setup-guide.md). Per
 * instruction, this starts the whole context already signed in via the
 * transplanted session at playwright/.auth/user.json
 * (startSignedInContext, the same pattern proven on fn04-cart-
 * management's TP-04-006), then proceeds through checkout normally.
 * Needs a real, freshly captured session file to run.
 *
 * One order is completed by this procedure.
 */
test.describe('FN-05 Checkout', () => {
  test('TP-05-006 signed-in checkout', async ({ browser }, testInfo) => {
    test.setTimeout(120_000);

    const signedIn = await startSignedInContext(browser);
    const { page, header, catalog, product, cart, checkout } = signedIn;
    const confirmation = new ConfirmationPage(page);
    const account = new MyAccountPage(page);

    await test.step('Set Up — confirm empty cart baseline, signed in', async () => {
      await page.goto('/account', { waitUntil: 'domcontentloaded' });
      expect(page.url()).not.toContain('/account/login');
      await cart.goto();
      const remaining = await cart.lineCount();
      for (let i = remaining - 1; i >= 0; i--) {
        await cart.removeLine(i).click();
      }
      await cart.goto();
      expect(await cart.lineCount()).toBe(0);
    });

    await test.step('TC-05-010 #1 — add TD-05-A, proceed to checkout, Contact section reflects the signed-in account', async () => {
      await header.gotoHome();
      await catalog.goto();
      await catalog.grid.locator('a').first().click();
      await page.waitForLoadState('domcontentloaded');
      await product.addToCartButton.click();
      await page.waitForLoadState('networkidle').catch(() => {});
      await cart.goto();
      await cart.checkoutButton.click();
      await page.waitForLoadState('domcontentloaded');
      const url = await recordUrl(page, testInfo, 'Checkout reached (signed in)');

      expect(url).toContain('/checkouts/');
      // Signed-in shoppers reach checkout without the guest "Sign in"
      // prompt shown on the guest route (see TP-05-001).
      await expect(checkout.signInLink).not.toBeVisible();

      // The Wrap Up requires the Contact section state observed after
      // signing in to be attached, not only asserted.
      await testInfo.attach('Contact section state — signed in', {
        body:
          `destination: ${url}\n` +
          `"Sign in" prompt offered: ${await checkout.signInLink.isVisible()}\n` +
          'NOTE: the signed-in state was established from a transplanted session ' +
          '(playwright/.auth/user.json), not by signing in from the Contact section. ' +
          'ENV-19 requires sign-in to be performed as a step of the test case — that ' +
          'path is hCaptcha-protected and could not be automated, so TC-05-010 #1 is ' +
          'discharged by substitution rather than by the action the TC names.',
        contentType: 'text/plain',
      });
    });

    await test.step('TC-05-010 #2 — UK address, shipping method, approved payment, order completes', async () => {
      await fillDeliveryAddress(page, checkout, 'United Kingdom');
      await fillCard(checkout, TEST_CARDS.approved, '12/29', '123', NAME_ON_CARD);
      await recordSimulationValue(testInfo, 'TC-05-010 #2', SIMULATION_VALUES.approved);
      // The contact address is the account's own, since this context is
      // signed in — read it back rather than assumed, so SPR-18 records the
      // address this order was actually raised against.
      const contactAddress =
        (await checkout.emailField.inputValue().catch(() => null)) ??
        (await page.getByText(/@/).first().innerText().catch(() => null)) ??
        '(not readable from the Contact section)';

      await checkout.payNowButton.click();
      await page.waitForURL(/\/(thank[_-]?you|orders)/i, { timeout: 20000 }).catch(() => {});
      await recordUrl(page, testInfo, 'After Pay now (signed in)');

      await expect(confirmation.thankYouHeading).toBeVisible();
      await expect(confirmation.confirmationNumber).toBeVisible();
      const confirmationText = await confirmation.confirmationNumber.textContent();
      // SPR-18: confirmation number AND contact address.
      await testInfo.attach('Confirmation number and contact address (TC-05-010)', {
        body: `confirmation: ${confirmationText ?? '(not found)'}\ncontact address: ${contactAddress}`,
        contentType: 'text/plain',
      });
      // The Wrap Up requires the confirmation page itself.
      await testInfo.attach('Confirmation page summary (TC-05-010)', {
        body: (await page.locator('main').innerText().catch(() => '')) || '(summary not readable)',
        contentType: 'text/plain',
      });
      await testInfo.attach('Confirmation page — screenshot (TC-05-010)', {
        body: await page.screenshot({ fullPage: true }),
        contentType: 'image/png',
      });
    });

    await test.step('TC-05-010 #3 — order history shows the completed order associated with the account', async () => {
      await account.goto();
      const orderCount = await account.orderRows.count();
      const firstOrderText = orderCount > 0 ? await account.orderRows.first().innerText() : '(no orders listed)';
      await testInfo.attach('Order history listing', {
        body: `order rows: ${orderCount}\nmost recent: ${firstOrderText}`,
        contentType: 'text/plain',
      });
      expect(orderCount).toBeGreaterThan(0);
    });

    await test.step('Wrap Up — sign out, return to store home page, confirm cart empty', async () => {
      await header.logOutLink.click().catch(() => {});
      await header.gotoHome();
      await cart.goto();
      expect(await cart.lineCount()).toBe(0);
      await signedIn.context.close();
    });
  });
});
