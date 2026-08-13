import { test, expect } from '../../utils/pacedTest';
import { withFailureEvidence } from '../../utils/evidence';
import { ACCOUNT_TEST_DATA } from '../../fixtures/test-data';
import {
  startSignedInContext,
  emptyAddressBook,
  fillNewAddressForm,
  submitNewAddress,
  recordAddressValuesEntered,
  recordValidationMessages,
  runWrapUp,
  closeContextWithVideo,
} from './_helpers';

/**
 * TP-06-002 — Verify the save is blocked with a validation message when a
 * required field is invalid, that the first saved address becomes the
 * default and a later address becomes the default only when the checkbox
 * is ticked, that the address counter displays the correct state for
 * several, one and no saved addresses, and that deletion decrements the
 * counter and reassigns the default where the deleted address held it.
 * Executed in document order 007, 008, 006, 009 (not numerically), per
 * the TPS's own note: the procedure follows the life of the address book.
 *
 * THIS PROCEDURE IS EXPECTED TO REPORT "FAIL", AND THAT IS THE CORRECT
 * RESULT — the TC-06-007 section asserts an outcome the store does not
 * deliver, so the procedure genuinely does not pass. The Fail is
 * cross-referenced to DEF-F6-05 in the test log's Remark column.
 *
 * DEF-F6-05 confirmed live (this session's address-book repair: Country
 * only, every other required-looking field blank, still saved without
 * error). TC-06-007 expects a blocked save with no address created; the
 * real outcome is that the address IS created. That section is
 * soft-asserted so the run still completes and the whole evidence set is
 * captured. TC-06-008, TC-06-006 and TC-06-009 have no contradicting
 * defect and are hard-asserted — a failure in one of those is something
 * new and deserves investigation rather than being attributed to
 * DEF-F6-05.
 *
 * Confirmed live: the empty address book renders no distinct empty-state
 * element or message at all (just nothing where the cards would be), so
 * "the empty state" for TC-06-006 #3 is asserted as addressCards having a
 * count of zero.
 */
test.describe('FN-06 Account and Address Management', () => {
  test('TP-06-002 address book count and default', async ({ browser }, testInfo) => {
    // 13 steps and 8 address saves, plus repeated My Account trips for the
    // counter readings. TP-06-001 (roughly 20 saves) took 5.3 min live on
    // 13 Aug, so 180s left very little headroom here — and a run killed at
    // its cap loses the Wrap Up with it, leaving the shared account dirty
    // for the next procedure. Raised rather than risk that.
    test.setTimeout(300_000);

    const { context, page, header, addressBook, myAccount } = await startSignedInContext(browser, undefined, testInfo);

    try {
    await withFailureEvidence(page, testInfo, 'TP-06-002 unexpected failure', async () => {
      await test.step('Set Up — empty the address book (TP-06-001 already executed)', async () => {
        await emptyAddressBook(page, addressBook);
        expect(await addressBook.addressCards.count()).toBe(0);
      });

      await test.step('TC-06-007 #1 — Address Line 1 empty: TPS expects blocked save (DEF-F6-05)', async () => {
        const values = {
          firstName: ACCOUNT_TEST_DATA.name.firstName,
          lastName: ACCOUNT_TEST_DATA.name.lastName,
          country: ACCOUNT_TEST_DATA.malaysiaAddress.country,
          province: ACCOUNT_TEST_DATA.malaysiaAddress.province,
          city: ACCOUNT_TEST_DATA.malaysiaAddress.city,
          company: ACCOUNT_TEST_DATA.malaysiaAddress.company,
          zip: ACCOUNT_TEST_DATA.malaysiaAddress.zip,
          phone: ACCOUNT_TEST_DATA.malaysiaAddress.phone,
        };
        const before = await addressBook.addressCards.count();
        await fillNewAddressForm(page, addressBook, values);
        await recordAddressValuesEntered(testInfo, 'TC-06-007 #1', values);
        await submitNewAddress(page, addressBook);
        const messages = await recordValidationMessages(page, testInfo, 'TC-06-007 #1');
        const afterOnAddressesPage = await addressBook.addressCards.count();
        await myAccount.goto();
        const counter = await myAccount.addressesLabel();
        await addressBook.goto();
        await testInfo.attach('Address counter after attempted save — TC-06-007 #1', { body: counter, contentType: 'text/plain' });

        expect.soft(afterOnAddressesPage, 'TC-06-007 #1: TPS expects save blocked (count unchanged); DEF-F6-05 contradicts this').toBe(before);
        expect.soft(messages.length, 'TC-06-007 #1: TPS expects a validation message').toBeGreaterThan(0);

        // Clean up whatever DEF-F6-05 actually created, so TC-06-008 starts
        // from a genuinely empty book as its own Set Up requires.
        await emptyAddressBook(page, addressBook);
        expect(await addressBook.addressCards.count()).toBe(0);
      });

      await test.step('TC-06-008 #1 — first address saved becomes the default', async () => {
        const values = {
          firstName: ACCOUNT_TEST_DATA.name.firstName,
          lastName: ACCOUNT_TEST_DATA.name.lastName,
          country: ACCOUNT_TEST_DATA.malaysiaAddress.country,
          province: ACCOUNT_TEST_DATA.malaysiaAddress.province,
          address1: ACCOUNT_TEST_DATA.malaysiaAddress.address1,
          city: ACCOUNT_TEST_DATA.malaysiaAddress.city,
          zip: ACCOUNT_TEST_DATA.malaysiaAddress.zip,
        };
        await fillNewAddressForm(page, addressBook, values);
        await recordAddressValuesEntered(testInfo, 'TC-06-008 #1', values);
        await submitNewAddress(page, addressBook);

        expect(await addressBook.addressCards.count()).toBe(1);
        expect(await addressBook.isCardDefault(0)).toBe(true);
      });

      await test.step('TC-06-008 #2 — second address with Set as default ticked becomes the new default', async () => {
        const values = {
          firstName: 'Second',
          lastName: ACCOUNT_TEST_DATA.name.lastName,
          country: ACCOUNT_TEST_DATA.malaysiaAddress.country,
          province: ACCOUNT_TEST_DATA.malaysiaAddress.province,
          address1: ACCOUNT_TEST_DATA.malaysiaAddress.address1,
          city: ACCOUNT_TEST_DATA.malaysiaAddress.city,
          zip: ACCOUNT_TEST_DATA.malaysiaAddress.zip,
          setDefault: true,
        };
        await fillNewAddressForm(page, addressBook, values);
        await recordAddressValuesEntered(testInfo, 'TC-06-008 #2', values);
        await submitNewAddress(page, addressBook);

        expect(await addressBook.addressCards.count()).toBe(2);
        const defaults = await Promise.all([addressBook.isCardDefault(0), addressBook.isCardDefault(1)]);
        expect(defaults.filter(Boolean).length).toBe(1);
        expect(await addressBook.cardText(1).innerText()).toContain('(default)');
      });

      await test.step('TC-06-008 #3 — third address with Set as default unticked leaves the existing default unchanged', async () => {
        const values = {
          firstName: 'Third',
          lastName: ACCOUNT_TEST_DATA.name.lastName,
          country: ACCOUNT_TEST_DATA.malaysiaAddress.country,
          province: ACCOUNT_TEST_DATA.malaysiaAddress.province,
          address1: ACCOUNT_TEST_DATA.malaysiaAddress.address1,
          city: ACCOUNT_TEST_DATA.malaysiaAddress.city,
          zip: ACCOUNT_TEST_DATA.malaysiaAddress.zip,
        };
        await fillNewAddressForm(page, addressBook, values);
        await recordAddressValuesEntered(testInfo, 'TC-06-008 #3', values);
        await submitNewAddress(page, addressBook);

        expect(await addressBook.addressCards.count()).toBe(3);
        const defaults = await Promise.all([
          addressBook.isCardDefault(0),
          addressBook.isCardDefault(1),
          addressBook.isCardDefault(2),
        ]);
        expect(defaults.filter(Boolean).length).toBe(1);
        expect(defaults[1]).toBe(true); // still the second address (TC-06-008 #2)
      });

      await test.step('TC-06-006 #1 — three addresses: header reads "Addresses (3)", matching the cards shown', async () => {
        await myAccount.goto();
        const label = await myAccount.addressesLabel();
        await testInfo.attach('Addresses counter — TC-06-006 #1', { body: label, contentType: 'text/plain' });
        expect(label).toContain('Addresses (3)');
        await addressBook.goto();
        expect(await addressBook.addressCards.count()).toBe(3);
      });

      await test.step('TC-06-006 #2 — delete down to one: header reads "Addresses (1)", remaining address shown as default', async () => {
        page.once('dialog', (d) => d.accept());
        await addressBook.deleteLink(2).click();
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(500);
        page.once('dialog', (d) => d.accept());
        await addressBook.deleteLink(1).click();
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(500);

        expect(await addressBook.addressCards.count()).toBe(1);
        await myAccount.goto();
        const label = await myAccount.addressesLabel();
        await testInfo.attach('Addresses counter — TC-06-006 #2', { body: label, contentType: 'text/plain' });
        expect(label).toContain('Addresses (1)');
        await addressBook.goto();
        expect(await addressBook.isCardDefault(0)).toBe(true);
      });

      await test.step('TC-06-006 #3 — delete the last remaining address: header reads "Addresses (0)", empty state replaces the cards', async () => {
        page.once('dialog', (d) => d.accept());
        await addressBook.deleteLink(0).click();
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(500);

        expect(await addressBook.addressCards.count()).toBe(0);
        await myAccount.goto();
        const label = await myAccount.addressesLabel();
        await testInfo.attach('Addresses counter — TC-06-006 #3', { body: label, contentType: 'text/plain' });
        expect(label).toContain('Addresses (0)');
      });

      await test.step('Reset — save two addresses, one of which is the default, for TC-06-009', async () => {
        await addressBook.goto();
        const first = {
          firstName: 'First',
          lastName: ACCOUNT_TEST_DATA.name.lastName,
          country: ACCOUNT_TEST_DATA.malaysiaAddress.country,
          province: ACCOUNT_TEST_DATA.malaysiaAddress.province,
          address1: ACCOUNT_TEST_DATA.malaysiaAddress.address1,
          city: ACCOUNT_TEST_DATA.malaysiaAddress.city,
          zip: ACCOUNT_TEST_DATA.malaysiaAddress.zip,
        };
        await fillNewAddressForm(page, addressBook, first);
        await submitNewAddress(page, addressBook);
        const second = { ...first, firstName: 'Second' };
        await fillNewAddressForm(page, addressBook, second);
        await submitNewAddress(page, addressBook);

        expect(await addressBook.addressCards.count()).toBe(2);
      });

      await test.step('TC-06-009 #1 — delete the non-default address: counter decrements to one, default stays on the address that held it', async () => {
        const defaultsBefore = await Promise.all([addressBook.isCardDefault(0), addressBook.isCardDefault(1)]);
        const defaultIndexBefore = defaultsBefore.indexOf(true);
        const nonDefaultIndex = defaultIndexBefore === 0 ? 1 : 0;

        page.once('dialog', (d) => d.accept());
        await addressBook.deleteLink(nonDefaultIndex).click();
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(500);

        expect(await addressBook.addressCards.count()).toBe(1);
        await myAccount.goto();
        const label = await myAccount.addressesLabel();
        await addressBook.goto();
        expect(label).toContain('Addresses (1)');
        expect(await addressBook.isCardDefault(0)).toBe(true);
      });

      await test.step('Reset — save a second address so two are present again, for TC-06-009 #2', async () => {
        const second = {
          firstName: 'Second',
          lastName: ACCOUNT_TEST_DATA.name.lastName,
          country: ACCOUNT_TEST_DATA.malaysiaAddress.country,
          province: ACCOUNT_TEST_DATA.malaysiaAddress.province,
          address1: ACCOUNT_TEST_DATA.malaysiaAddress.address1,
          city: ACCOUNT_TEST_DATA.malaysiaAddress.city,
          zip: ACCOUNT_TEST_DATA.malaysiaAddress.zip,
        };
        await fillNewAddressForm(page, addressBook, second);
        await submitNewAddress(page, addressBook);
        expect(await addressBook.addressCards.count()).toBe(2);
      });

      await test.step('TC-06-009 #2 — delete the default address: counter decrements to one, default reassigned to the remaining address', async () => {
        const defaultsBefore = await Promise.all([addressBook.isCardDefault(0), addressBook.isCardDefault(1)]);
        const defaultIndex = defaultsBefore.indexOf(true);

        page.once('dialog', (d) => d.accept());
        await addressBook.deleteLink(defaultIndex).click();
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(500);

        expect(await addressBook.addressCards.count()).toBe(1);
        await myAccount.goto();
        const label = await myAccount.addressesLabel();
        await addressBook.goto();
        expect(label).toContain('Addresses (1)');
        expect(await addressBook.isCardDefault(0)).toBe(true);
      });

      await test.step('TC-06-009 #3 — delete the last remaining address: counter shows zero, empty address book state displayed', async () => {
        page.once('dialog', (d) => d.accept());
        await addressBook.deleteLink(0).click();
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(500);

        expect(await addressBook.addressCards.count()).toBe(0);
        await myAccount.goto();
        const label = await myAccount.addressesLabel();
        await testInfo.attach('Addresses counter — TC-06-009 #3', { body: label, contentType: 'text/plain' });
        expect(label).toContain('Addresses (0)');
      });

    });
    } finally {
      await runWrapUp(testInfo, 'Wrap Up — confirm the address book is empty and sign out', async () => {
        // emptyAddressBook rather than a bare check: on the failure path
        // the procedure may not have reached its own deletions, and the
        // next procedure needs this account clean either way.
        await emptyAddressBook(page, addressBook);
        expect.soft(await addressBook.addressCards.count(), 'Wrap Up: address book should be empty').toBe(0);
        await header.logOutLink.click();
        await page.waitForLoadState('domcontentloaded');
        await header.gotoHome();
      });
      await closeContextWithVideo(context, page, testInfo, 'TP-06-002');
    }
  });
});
