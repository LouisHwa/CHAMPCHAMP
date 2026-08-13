import { test, expect } from '../../utils/pacedTest';
import { withFailureEvidence, recordUrl } from '../../utils/evidence';
import { FRESH_ACCOUNT_STATE_PATH } from '../../fixtures/credentials';
import { startSignedInContext, runWrapUp, closeContextWithVideo } from './_helpers';

/**
 * TP-06-006 — Verify the My Account page renders empty states rather than
 * an error for an account with no data (TC-06-013).
 *
 * No defect in the Defect Log contradicts this procedure — hard-asserted
 * throughout. Uses ENV-14's freshly registered account
 * (FRESH_ACCOUNT_STATE_PATH, playwright/.auth/fresh-user.json), captured
 * separately from TEST_ACCOUNT's session so it stays pristine — that
 * account cannot be the resettable account used elsewhere in this
 * section, per the TPS's own note, since an account that has held data
 * may render differently from one that never has.
 *
 * Confirmed live (9 Aug, on TEST_ACCOUNT with 0 orders): the order-history
 * section renders the literal text "You haven't placed any orders yet."
 * rather than a blank region when there are no orders. The addresses
 * section on this page is just the "Addresses (n)" counter link — for a
 * fresh account this reads "Addresses (0)", which is itself the
 * confirmation that no error/blank region occurred (there's no separate
 * empty-state markup for it here, unlike /account/addresses).
 */
test.describe('FN-06 Account and Address Management', () => {
  test('TP-06-006 My Account empty state for a freshly registered account', async ({ browser }, testInfo) => {
    test.setTimeout(90_000);

    const { context, page, header, myAccount } = await startSignedInContext(browser, FRESH_ACCOUNT_STATE_PATH, testInfo);

    try {
    await withFailureEvidence(page, testInfo, 'TP-06-006 unexpected failure', async () => {
      await test.step('Set Up — confirm ENV-14: the account holds no orders and no saved addresses', async () => {
        // The TPS's Set Up step 1 says to "confirm that a freshly registered
        // account holding no orders and no saved addresses is available" —
        // CONFIRM, not establish. Unlike every other FN-06 procedure, this
        // one must not empty the address book itself: an account emptied by
        // the test is not the same as one that never held anything, and it
        // is the empty state of a genuinely fresh account under test here.
        // ENV-14 is the tester's to set up; this step verifies it and fails
        // with a clear reason if it has not been, rather than letting the
        // shortfall surface later as an apparent rendering defect.
        await myAccount.goto();
        const orders = await myAccount.orderRows.count();
        const addresses = await myAccount.addressesLabel();
        await testInfo.attach('ENV-14 precondition check', {
          body: `order rows: ${orders}\naddresses label: ${addresses}`,
          contentType: 'text/plain',
        });
        expect(orders, 'ENV-14 not satisfied: the account under test already holds orders — sign in as the freshly registered account').toBe(0);
        expect(addresses, 'ENV-14 not satisfied: the account under test already holds saved addresses — clear them, or use a genuinely fresh account, before running this procedure').toContain('Addresses (0)');
      });

      await test.step('TC-06-013 #1 — My Account page loads without an error', async () => {
        await myAccount.goto();
        const url = await recordUrl(page, testInfo, 'My Account — fresh account');
        expect(url).not.toContain('/account/login');
        await expect(page.getByRole('heading', { name: 'Account Details and Order History' })).toBeVisible();
      });

      await test.step('TC-06-013 #2 — order history and address sections both render an empty state, not an error or blank region', async () => {
        const orderRowCount = await myAccount.orderRows.count();
        const orderHistoryText = await page.locator('.order-history').innerText();
        const addressesLabel = await myAccount.addressesLabel();

        await testInfo.attach('Order history and address sections — fresh account', {
          body: `order rows: ${orderRowCount}\norder-history section text:\n${orderHistoryText}\n\naddresses label: ${addressesLabel}`,
          contentType: 'text/plain',
        });

        expect(orderRowCount).toBe(0);
        expect(orderHistoryText).toContain("haven't placed any orders");
        expect(orderHistoryText.trim().length).toBeGreaterThan(0);
        expect(addressesLabel).toContain('Addresses (0)');
      });

    });
    } finally {
      await runWrapUp(testInfo, 'Wrap Up — sign out of the freshly registered account, return to store home page', async () => {
        await header.logOutLink.click();
        await page.waitForLoadState('domcontentloaded');
        await header.gotoHome();
      });
      await closeContextWithVideo(context, page, testInfo, 'TP-06-006');
    }
  });
});
