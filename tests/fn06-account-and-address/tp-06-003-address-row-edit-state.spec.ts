import { test, expect } from '../../utils/pacedTest';
import { withFailureEvidence } from '../../utils/evidence';
import { ACCOUNT_TEST_DATA } from '../../fixtures/test-data';
import { startSignedInContext, emptyAddressBook, fillNewAddressForm, submitNewAddress, runWrapUp, closeContextWithVideo } from './_helpers';

const A = 0;
const B = 1;

/**
 * TP-06-003 — Verify only one address is in edit mode at a time across all
 * transitions of the address row state machine (TC-06-010, 8 steps).
 *
 * THIS PROCEDURE IS EXPECTED TO REPORT "FAIL", AND THAT IS THE CORRECT
 * RESULT — the store does not enforce the single-edit-mode rule the TPS
 * expects, so the procedure genuinely does not pass. The Fail is
 * cross-referenced to DEF-F6-02 in the test log's Remark column.
 *
 * DEF-F6-02 confirmed live (9 Aug direct
 * capture): opening Edit on a second address while a first is already open
 * leaves BOTH edit forms visible simultaneously. The site's toggleForm(id)
 * call is a pure per-card toggle — it has no awareness of, and no closing
 * effect on, any other card's edit form; there is no single-edit-mode
 * enforcement at all. Both "Edit" (in the collapsed view) and "Cancel" (in
 * the open edit form) call the identical toggleForm(id) for their own
 * card, so clicking "Edit" on a card that is already open (a state this
 * defect can produce) toggles it CLOSED rather than doing nothing.
 *
 * Steps #1-#2 start from a guaranteed-clean, single-open state (nothing
 * has yet been open next to something else) and are hard-asserted. From
 * step #3 onward, the sequence is downstream of the first dual-open
 * trigger, so every step's outcome may already be affected by DEF-F6-02;
 * per the TPS's own note ("every step records the state of both address
 * rows... since REQ-F6-04 constrains the pair"), both cards' open/closed
 * state is recorded as evidence at every step and soft-asserted against
 * the TPS's literal expectation rather than hard-asserted.
 */
test.describe('FN-06 Account and Address Management', () => {
  test('TP-06-003 address row edit state transitions', async ({ browser }, testInfo) => {
    test.setTimeout(150_000);

    const { context, page, header, addressBook } = await startSignedInContext(browser, undefined, testInfo);

    // Declared outside the try so the Wrap Up in `finally` can record the
    // final pair state too — the TPS asks for both rows' state at every
    // step, and the state left behind by a failed run is worth capturing.
    const recordPairState = async (label: string) => {
      const openA = await addressBook.isEditFormOpen(A);
      const openB = await addressBook.isEditFormOpen(B);
      await testInfo.attach(`Edit-mode state — ${label}`, {
        body: `address A open: ${openA}\naddress B open: ${openB}`,
        contentType: 'text/plain',
      });
      return { openA, openB };
    };

    try {
    await withFailureEvidence(page, testInfo, 'TP-06-003 unexpected failure', async () => {
      await test.step('Set Up — empty the address book, save two addresses (A and B) from TD-06-MY', async () => {
        await emptyAddressBook(page, addressBook);
        const base = {
          country: ACCOUNT_TEST_DATA.malaysiaAddress.country,
          province: ACCOUNT_TEST_DATA.malaysiaAddress.province,
          address1: ACCOUNT_TEST_DATA.malaysiaAddress.address1,
          city: ACCOUNT_TEST_DATA.malaysiaAddress.city,
          zip: ACCOUNT_TEST_DATA.malaysiaAddress.zip,
        };
        await fillNewAddressForm(page, addressBook, { ...base, firstName: 'AddressA', lastName: ACCOUNT_TEST_DATA.name.lastName });
        await submitNewAddress(page, addressBook);
        await fillNewAddressForm(page, addressBook, { ...base, firstName: 'AddressB', lastName: ACCOUNT_TEST_DATA.name.lastName });
        await submitNewAddress(page, addressBook);
        expect(await addressBook.addressCards.count()).toBe(2);
      });

      await test.step('TC-06-010 #1 — Edit(A): A opens, B stays in view mode', async () => {
        await addressBook.editLink(A).click();
        await page.waitForTimeout(400);
        const state = await recordPairState('after #1');
        expect(state.openA).toBe(true);
        expect(state.openB).toBe(false);
      });

      await test.step('TC-06-010 #2 — Cancel(A), then Edit(B): B opens, A stays in view mode', async () => {
        await addressBook.cancelEditLink(A).click();
        await page.waitForTimeout(400);
        await addressBook.editLink(B).click();
        await page.waitForTimeout(400);
        const state = await recordPairState('after #2');
        expect(state.openB).toBe(true);
        expect(state.openA).toBe(false);
      });

      await test.step('TC-06-010 #3 — with B open, Edit(A): TPS expects A opens AND B returns to view mode (DEF-F6-02)', async () => {
        await addressBook.editLink(A).click();
        await page.waitForTimeout(400);
        const state = await recordPairState('after #3');
        expect.soft(state.openA, 'TC-06-010 #3: A should open').toBe(true);
        expect.soft(state.openB, 'TC-06-010 #3: TPS expects B to return to view mode; DEF-F6-02 contradicts this').toBe(false);
      });

      await test.step('TC-06-010 #4 — with A open, Edit(B): TPS expects B opens AND A returns to view mode (DEF-F6-02)', async () => {
        await addressBook.editLink(B).click();
        await page.waitForTimeout(400);
        const state = await recordPairState('after #4');
        expect.soft(state.openB, 'TC-06-010 #4: B should open').toBe(true);
        expect.soft(state.openA, 'TC-06-010 #4: TPS expects A to return to view mode; DEF-F6-02 contradicts this').toBe(false);
      });

      await test.step('TC-06-010 #5 — with B in edit, save: edit is saved, B returns to view mode, none left in edit mode', async () => {
        // Whatever state #3/#4 actually left behind, force a known starting
        // point for this step: make sure B is open before saving it.
        if (!(await addressBook.isEditFormOpen(B))) {
          await addressBook.editLink(B).click();
          await page.waitForTimeout(400);
        }
        await addressBook.saveEditButton(B).click();
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(500);
        const state = await recordPairState('after #5');
        expect.soft(state.openB, 'TC-06-010 #5: B should return to view mode after saving').toBe(false);
        expect.soft(state.openA, 'TC-06-010 #5: TPS expects no address left in edit mode').toBe(false);
      });

      await test.step('TC-06-010 #6 — Edit(B), then Cancel: edit discarded, B returns to view mode, none left in edit mode', async () => {
        await addressBook.editLink(B).click();
        await page.waitForTimeout(400);
        await addressBook.cancelEditLink(B).click();
        await page.waitForTimeout(400);
        const state = await recordPairState('after #6');
        expect.soft(state.openB, 'TC-06-010 #6: B should return to view mode after cancel').toBe(false);
        expect.soft(state.openA, 'TC-06-010 #6: TPS expects no address left in edit mode').toBe(false);
      });

      await test.step('TC-06-010 #7 — Edit(A), then save: edit is saved, A returns to view mode, none left in edit mode', async () => {
        await addressBook.editLink(A).click();
        await page.waitForTimeout(400);
        await addressBook.saveEditButton(A).click();
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(500);
        const state = await recordPairState('after #7');
        expect.soft(state.openA, 'TC-06-010 #7: A should return to view mode after saving').toBe(false);
        expect.soft(state.openB, 'TC-06-010 #7: TPS expects no address left in edit mode').toBe(false);
      });

      await test.step('TC-06-010 #8 — Edit(A), then Cancel: edit discarded, A returns to view mode, none left in edit mode', async () => {
        await addressBook.editLink(A).click();
        await page.waitForTimeout(400);
        await addressBook.cancelEditLink(A).click();
        await page.waitForTimeout(400);
        const state = await recordPairState('after #8');
        expect.soft(state.openA, 'TC-06-010 #8: A should return to view mode after cancel').toBe(false);
        expect.soft(state.openB, 'TC-06-010 #8: TPS expects no address left in edit mode').toBe(false);
      });

    });
    } finally {
      await runWrapUp(testInfo, 'Wrap Up — confirm no address in edit mode, empty the address book, sign out', async () => {
        await recordPairState('Wrap Up').catch(() => {});
        await emptyAddressBook(page, addressBook);
        expect.soft(await addressBook.addressCards.count(), 'Wrap Up: address book should be empty').toBe(0);
        await header.logOutLink.click();
        await page.waitForLoadState('domcontentloaded');
        await header.gotoHome();
      });
      await closeContextWithVideo(context, page, testInfo, 'TP-06-003');
    }
  });
});
