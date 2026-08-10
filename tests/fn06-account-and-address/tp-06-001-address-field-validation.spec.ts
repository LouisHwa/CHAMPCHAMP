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
} from './_helpers';

/**
 * TP-06-001 — Verify the address form stores name values and falls back to
 * the account holder's name when they are empty, requires a country and a
 * subdivision where the country uses them, requires Address Line 1 and
 * City while leaving Address Line 2 and Company optional, validates the
 * postal code against the selected country, and treats the phone field as
 * optional but format constrained. Covers TC-06-001 through TC-06-005.
 *
 * EXPECTED TO FAIL, BY DESIGN, on several sections — marked via
 * test.fail() below, since Playwright only supports pass/fail at the whole
 * -test level. Live capture (9 Aug) confirmed:
 *   - DEF-F6-04: leaving Country unselected blocks the save with no visible
 *     error message, AND (beyond the log's original wording) the page does
 *     a full reload back to a closed, empty form rather than staying open
 *     with the entered values retained. Contradicts TC-06-002 #2.
 *   - DEF-F6-05: Address Line 1, City, State/Province and Postal Code are
 *     NOT enforced at all — a save with any of them blank still succeeds,
 *     confirmed live via the address-book repair performed this session
 *     (Country only, every other field blank, saved without error).
 *     Contradicts TC-06-002 #4, TC-06-003 #3-6, TC-06-004 #3-4.
 *   - DEF-F6-01: format is not validated at entry for any field, only at
 *     checkout. Contradicts TC-06-004 #2 (postcode format) and TC-06-005
 *     #4-5 (phone format).
 * The successful-save sections of TC-06-002 through TC-06-005 have no
 * contradicting defect and are hard-asserted; test.fail() applies to the
 * whole test, so the contradicted sections are what determine the overall
 * result even though the others genuinely pass.
 *
 * TC-06-001 #1-3 (name fallback for empty/partial names) are hard-asserted
 * too — no defect covers those. TC-06-001 #4 (BOTH names whitespace-only)
 * is soft-asserted: confirmed live (9 Aug) that the save is blocked
 * entirely rather than falling back to the account holder's name as the
 * TPS describes. This isn't explained by DEF-F6-01/04/05 (those cover
 * country/subdivision/address/zip/phone, not name fields) — flagged as a
 * candidate new defect for the team's Defect Log, not yet confirmed there.
 * The first live run of this file caught this the hard way: it was
 * originally hard-asserted, which threw past this point and skipped Wrap
 * Up entirely (the address book was left with 3 leftover addresses and
 * the session never got signed out) — a reminder that an unexpected hard
 * -assert failure inside a test.fail() test is still silently reported as
 * "passed" overall, so an unfamiliar failure here always deserves a look
 * at exactly where it happened before assuming it's one of the above.
 *
 * TC-06-002 #5 (TD-06-UK) asserts the OPPOSITE of the TPS's literal
 * wording: live capture confirmed United Kingdom DOES carry subdivision
 * data on this store (England/Northern Ireland/Scotland/Wales/British
 * Forces), so TD-06-UK's premise ("a country that does not use
 * subdivisions") does not hold here. This is a test-data table error, not
 * a site defect, per the team's own direction — see AddressBookPage.ts and
 * fixtures/test-data.ts for the same note.
 */
test.describe('FN-06 Account and Address Management', () => {
  test('TP-06-001 address field validation', async ({ browser }, testInfo) => {
    test.fail(true, 'Confirmed defects DEF-F6-01, DEF-F6-04, DEF-F6-05, plus a candidate new defect (whitespace-only names block the save — TC-06-001 #4) contradict several sections of this procedure.');
    test.setTimeout(240_000);

    const { context, page, header, addressBook, myAccount } = await startSignedInContext(browser);

    await withFailureEvidence(page, testInfo, 'TP-06-001 unexpected failure', async () => {
      await test.step('Set Up — empty the address book', async () => {
        await emptyAddressBook(page, addressBook);
        expect(await addressBook.addressCards.count()).toBe(0);
      });

      await test.step('TC-06-001 #1 — name values from TD-06-NAME stored exactly', async () => {
        const values = {
          address1: ACCOUNT_TEST_DATA.malaysiaAddress.address1,
          city: ACCOUNT_TEST_DATA.malaysiaAddress.city,
          country: ACCOUNT_TEST_DATA.malaysiaAddress.country,
          province: ACCOUNT_TEST_DATA.malaysiaAddress.province,
          zip: ACCOUNT_TEST_DATA.malaysiaAddress.zip,
          firstName: ACCOUNT_TEST_DATA.name.firstName,
          lastName: ACCOUNT_TEST_DATA.name.lastName,
        };
        const before = await addressBook.addressCards.count();
        await fillNewAddressForm(page, addressBook, values);
        await recordAddressValuesEntered(testInfo, 'TC-06-001 #1', values);
        await submitNewAddress(page, addressBook);

        expect(await addressBook.addressCards.count()).toBe(before + 1);
        const cardText = await addressBook.cardText(before).innerText();
        expect(cardText).toContain(ACCOUNT_TEST_DATA.name.firstName);
        expect(cardText).toContain(ACCOUNT_TEST_DATA.name.lastName);
      });

      await test.step('TC-06-001 #2 — First Name empty stays blank, no fallback', async () => {
        const values = {
          address1: ACCOUNT_TEST_DATA.malaysiaAddress.address1,
          city: ACCOUNT_TEST_DATA.malaysiaAddress.city,
          country: ACCOUNT_TEST_DATA.malaysiaAddress.country,
          province: ACCOUNT_TEST_DATA.malaysiaAddress.province,
          zip: ACCOUNT_TEST_DATA.malaysiaAddress.zip,
          lastName: ACCOUNT_TEST_DATA.name.lastName,
        };
        const before = await addressBook.addressCards.count();
        await fillNewAddressForm(page, addressBook, values);
        await recordAddressValuesEntered(testInfo, 'TC-06-001 #2', values);
        await submitNewAddress(page, addressBook);

        expect(await addressBook.addressCards.count()).toBe(before + 1);
        const cardText = await addressBook.cardText(before).innerText();
        expect(cardText).toContain(ACCOUNT_TEST_DATA.name.lastName);
        expect(cardText).not.toContain('Dave');
      });

      await test.step('TC-06-001 #3 — both names empty, account holder name applied', async () => {
        const values = {
          address1: ACCOUNT_TEST_DATA.malaysiaAddress.address1,
          city: ACCOUNT_TEST_DATA.malaysiaAddress.city,
          country: ACCOUNT_TEST_DATA.malaysiaAddress.country,
          province: ACCOUNT_TEST_DATA.malaysiaAddress.province,
          zip: ACCOUNT_TEST_DATA.malaysiaAddress.zip,
        };
        const before = await addressBook.addressCards.count();
        await fillNewAddressForm(page, addressBook, values);
        await recordAddressValuesEntered(testInfo, 'TC-06-001 #3', values);
        await submitNewAddress(page, addressBook);

        expect(await addressBook.addressCards.count()).toBe(before + 1);
        const cardText = await addressBook.cardText(before).innerText();
        const accountHolderName = (await myAccount.page.locator('.customer-name').isVisible().catch(() => false))
          ? await myAccount.page.locator('.customer-name').textContent()
          : null;
        await testInfo.attach('TC-06-001 #3 — account holder name vs card text', {
          body: `account holder name: ${accountHolderName ?? '(not read on this page)'}\ncard text: ${cardText}`,
          contentType: 'text/plain',
        });
        expect(cardText.trim().length).toBeGreaterThan(0);
        expect(cardText).not.toMatch(/^\s*\(default\)?\s*(<br>)*\s*Malaysia/);
      });

      await test.step('TC-06-001 #4 — both names whitespace-only: TPS expects treated as no entry, account holder name applied (candidate new defect — see below)', async () => {
        const values = {
          address1: ACCOUNT_TEST_DATA.malaysiaAddress.address1,
          city: ACCOUNT_TEST_DATA.malaysiaAddress.city,
          country: ACCOUNT_TEST_DATA.malaysiaAddress.country,
          province: ACCOUNT_TEST_DATA.malaysiaAddress.province,
          zip: ACCOUNT_TEST_DATA.malaysiaAddress.zip,
          firstName: '   ',
          lastName: '   ',
        };
        const before = await addressBook.addressCards.count();
        await fillNewAddressForm(page, addressBook, values);
        await recordAddressValuesEntered(testInfo, 'TC-06-001 #4', values);
        await submitNewAddress(page, addressBook);

        const after = await addressBook.addressCards.count();
        await testInfo.attach('TC-06-001 #4 — candidate new defect: whitespace-only names block the save entirely', {
          body:
            `address count before: ${before}\naddress count after: ${after}\n\n` +
            `TPS expects whitespace-only First Name/Last Name to be treated as no entry ` +
            `(same as genuinely empty, per TC-06-001 #3), saving the address with the ` +
            `account holder's name applied as fallback. Confirmed live (9 Aug): the save ` +
            `is instead blocked entirely — no address is created at all. This is not ` +
            `explained by any currently-logged defect (DEF-F6-01/04/05 cover country/` +
            `subdivision/address/zip/phone, not name fields) — flagged here as a ` +
            `candidate new defect for the team's Defect Log, not yet confirmed there.`,
          contentType: 'text/plain',
        });

        // TPS expects a 4th address with fallback names; the candidate defect above contradicts this.
        expect.soft(after, 'TC-06-001 #4: TPS expects the address to save with account-holder-name fallback').toBe(before + 1);
      });

      await test.step('Reset — empty the address book before TC-06-002', async () => {
        await emptyAddressBook(page, addressBook);
        expect(await addressBook.addressCards.count()).toBe(0);
      });

      await test.step('TC-06-002 #1 — Country Malaysia stores selection, subdivision rules follow it', async () => {
        const values = {
          firstName: ACCOUNT_TEST_DATA.name.firstName,
          lastName: ACCOUNT_TEST_DATA.name.lastName,
          address1: ACCOUNT_TEST_DATA.malaysiaAddress.address1,
          city: ACCOUNT_TEST_DATA.malaysiaAddress.city,
          country: ACCOUNT_TEST_DATA.malaysiaAddress.country,
          province: ACCOUNT_TEST_DATA.malaysiaAddress.province,
          zip: ACCOUNT_TEST_DATA.malaysiaAddress.zip,
        };
        const before = await addressBook.addressCards.count();
        await fillNewAddressForm(page, addressBook, values);
        await expect(addressBook.provinceContainer).toBeVisible();
        await recordAddressValuesEntered(testInfo, 'TC-06-002 #1', values);
        await submitNewAddress(page, addressBook);

        expect(await addressBook.addressCards.count()).toBe(before + 1);
        const cardText = await addressBook.cardText(before).innerText();
        expect(cardText).toContain('Malaysia');
        expect(cardText).toContain(ACCOUNT_TEST_DATA.malaysiaAddress.province);
      });

      await test.step('TC-06-002 #2 — Country left on placeholder: TPS expects blocked save with a message and retained values (DEF-F6-04)', async () => {
        const values = {
          firstName: ACCOUNT_TEST_DATA.name.firstName,
          lastName: ACCOUNT_TEST_DATA.name.lastName,
          address1: ACCOUNT_TEST_DATA.malaysiaAddress.address1,
          city: ACCOUNT_TEST_DATA.malaysiaAddress.city,
          zip: ACCOUNT_TEST_DATA.malaysiaAddress.zip,
        };
        const before = await addressBook.addressCards.count();
        await fillNewAddressForm(page, addressBook, values);
        await recordAddressValuesEntered(testInfo, 'TC-06-002 #2', values);
        await submitNewAddress(page, addressBook);

        const messages = await recordValidationMessages(page, testInfo, 'TC-06-002 #2');
        const afterOnAddressesPage = await addressBook.addressCards.count();
        await myAccount.goto();
        const counter = await myAccount.addressesLabel();
        await addressBook.goto();
        await testInfo.attach('Address counter after blocked save — TC-06-002 #2', { body: counter, contentType: 'text/plain' });

        // Confirmed as-blocked (DEF-F6-04): no address created. What the
        // TPS additionally expects and the defect contradicts:
        expect.soft(messages.length, 'TC-06-002 #2: TPS expects a validation message identifying Country').toBeGreaterThan(0);
        expect.soft(afterOnAddressesPage, 'TC-06-002 #2: address count should be unchanged (it is — this assertion documents that DEF-F6-04 at least gets this part right)').toBe(before);
        expect.soft(await addressBook.newAddressForm.isVisible(), 'TC-06-002 #2: TPS expects the shopper to remain on the form with values retained').toBe(true);
      });

      await test.step('TC-06-002 #3 — State Selangor stores subdivision list and selection', async () => {
        const values = {
          firstName: ACCOUNT_TEST_DATA.name.firstName,
          lastName: ACCOUNT_TEST_DATA.name.lastName,
          address1: ACCOUNT_TEST_DATA.malaysiaAddress.address1,
          city: ACCOUNT_TEST_DATA.malaysiaAddress.city,
          country: ACCOUNT_TEST_DATA.malaysiaAddress.country,
          province: ACCOUNT_TEST_DATA.malaysiaAddress.province,
          zip: ACCOUNT_TEST_DATA.malaysiaAddress.zip,
        };
        const before = await addressBook.addressCards.count();
        await fillNewAddressForm(page, addressBook, values);
        const provinceOptionCount = await addressBook.provinceSelect.locator('option').count();
        await recordAddressValuesEntered(testInfo, 'TC-06-002 #3', values);
        await submitNewAddress(page, addressBook);

        expect(provinceOptionCount).toBeGreaterThan(1);
        expect(await addressBook.addressCards.count()).toBe(before + 1);
        expect(await addressBook.cardText(before).innerText()).toContain(ACCOUNT_TEST_DATA.malaysiaAddress.province);
      });

      await test.step('TC-06-002 #4 — State left on placeholder: TPS expects blocked save (DEF-F6-05)', async () => {
        const values = {
          firstName: ACCOUNT_TEST_DATA.name.firstName,
          lastName: ACCOUNT_TEST_DATA.name.lastName,
          address1: ACCOUNT_TEST_DATA.malaysiaAddress.address1,
          city: ACCOUNT_TEST_DATA.malaysiaAddress.city,
          country: ACCOUNT_TEST_DATA.malaysiaAddress.country,
          zip: ACCOUNT_TEST_DATA.malaysiaAddress.zip,
        };
        const before = await addressBook.addressCards.count();
        await fillNewAddressForm(page, addressBook, values);
        await recordAddressValuesEntered(testInfo, 'TC-06-002 #4', values);
        await submitNewAddress(page, addressBook);

        const messages = await recordValidationMessages(page, testInfo, 'TC-06-002 #4');
        const afterOnAddressesPage = await addressBook.addressCards.count();
        await myAccount.goto();
        const counter = await myAccount.addressesLabel();
        await addressBook.goto();
        await testInfo.attach('Address counter after attempted save — TC-06-002 #4', { body: counter, contentType: 'text/plain' });

        expect.soft(afterOnAddressesPage, 'TC-06-002 #4: TPS expects save blocked (count unchanged); DEF-F6-05 contradicts this').toBe(before);
        expect.soft(messages.length, 'TC-06-002 #4: TPS expects a validation message identifying the subdivision field').toBeGreaterThan(0);
      });

      await test.step('TC-06-002 #5 — Country United Kingdom: subdivision select IS presented, contra TD-06-UK\'s premise (test-data error, not a defect)', async () => {
        const values = {
          firstName: ACCOUNT_TEST_DATA.name.firstName,
          lastName: ACCOUNT_TEST_DATA.name.lastName,
          address1: ACCOUNT_TEST_DATA.ukAddress.address1,
          city: ACCOUNT_TEST_DATA.ukAddress.city,
          country: ACCOUNT_TEST_DATA.ukAddress.country,
          zip: ACCOUNT_TEST_DATA.ukAddress.zip,
        };
        const before = await addressBook.addressCards.count();
        await fillNewAddressForm(page, addressBook, values);
        const provinceVisible = await addressBook.provinceContainer.isVisible();
        await recordAddressValuesEntered(testInfo, 'TC-06-002 #5', values);
        await testInfo.attach('TC-06-002 #5 — subdivision select presence for United Kingdom', {
          body: `visible: ${provinceVisible} (TPS TD-06-UK expects false — live capture confirmed this store's UK data carries subdivisions, so true is correct here)`,
          contentType: 'text/plain',
        });
        await submitNewAddress(page, addressBook);

        expect(provinceVisible).toBe(true);
        expect(await addressBook.addressCards.count()).toBe(before + 1);
        expect(await addressBook.cardText(before).innerText()).toContain('United Kingdom');
      });

      await test.step('Reset — empty the address book before TC-06-003', async () => {
        await emptyAddressBook(page, addressBook);
        expect(await addressBook.addressCards.count()).toBe(0);
      });

      await test.step('TC-06-003 #1 — Address1/Address2/City/Company all stored as entered', async () => {
        const values = {
          firstName: ACCOUNT_TEST_DATA.name.firstName,
          lastName: ACCOUNT_TEST_DATA.name.lastName,
          country: ACCOUNT_TEST_DATA.malaysiaAddress.country,
          province: ACCOUNT_TEST_DATA.malaysiaAddress.province,
          zip: ACCOUNT_TEST_DATA.malaysiaAddress.zip,
          address1: ACCOUNT_TEST_DATA.malaysiaAddress.address1,
          address2: ACCOUNT_TEST_DATA.malaysiaAddress.address2,
          city: ACCOUNT_TEST_DATA.malaysiaAddress.city,
          company: ACCOUNT_TEST_DATA.malaysiaAddress.company,
        };
        const before = await addressBook.addressCards.count();
        await fillNewAddressForm(page, addressBook, values);
        await recordAddressValuesEntered(testInfo, 'TC-06-003 #1', values);
        await submitNewAddress(page, addressBook);

        expect(await addressBook.addressCards.count()).toBe(before + 1);
        // Case-insensitive: confirmed live (elsewhere, TP-06-005) that
        // Address1/Address2/City/Company can intermittently come back
        // lowercased (and Address1/Address2 merged onto one line) — a
        // timing race, not something tied to these specific values — see
        // _helpers.ts's fillNewAddressForm for the fuller account.
        const cardText = (await addressBook.cardText(before).innerText()).toLowerCase();
        expect(cardText).toContain(ACCOUNT_TEST_DATA.malaysiaAddress.address1.toLowerCase());
        expect(cardText).toContain(ACCOUNT_TEST_DATA.malaysiaAddress.address2.toLowerCase());
        expect(cardText).toContain(ACCOUNT_TEST_DATA.malaysiaAddress.city.toLowerCase());
        expect(cardText).toContain(ACCOUNT_TEST_DATA.malaysiaAddress.company.toLowerCase());
      });

      await test.step('TC-06-003 #2 — Address2/Company left empty, optional fields save blank with no validation message', async () => {
        const values = {
          firstName: ACCOUNT_TEST_DATA.name.firstName,
          lastName: ACCOUNT_TEST_DATA.name.lastName,
          country: ACCOUNT_TEST_DATA.malaysiaAddress.country,
          province: ACCOUNT_TEST_DATA.malaysiaAddress.province,
          zip: ACCOUNT_TEST_DATA.malaysiaAddress.zip,
          address1: ACCOUNT_TEST_DATA.malaysiaAddress.address1,
          city: ACCOUNT_TEST_DATA.malaysiaAddress.city,
        };
        const before = await addressBook.addressCards.count();
        await fillNewAddressForm(page, addressBook, values);
        await recordAddressValuesEntered(testInfo, 'TC-06-003 #2', values);
        await submitNewAddress(page, addressBook);
        const messages = await recordValidationMessages(page, testInfo, 'TC-06-003 #2');

        expect(await addressBook.addressCards.count()).toBe(before + 1);
        expect(messages.length).toBe(0);
      });

      await test.step('TC-06-003 #3 — Address1 empty: TPS expects blocked save (DEF-F6-05)', async () => {
        const values = {
          firstName: ACCOUNT_TEST_DATA.name.firstName,
          lastName: ACCOUNT_TEST_DATA.name.lastName,
          country: ACCOUNT_TEST_DATA.malaysiaAddress.country,
          province: ACCOUNT_TEST_DATA.malaysiaAddress.province,
          zip: ACCOUNT_TEST_DATA.malaysiaAddress.zip,
          city: ACCOUNT_TEST_DATA.malaysiaAddress.city,
        };
        const before = await addressBook.addressCards.count();
        await fillNewAddressForm(page, addressBook, values);
        await recordAddressValuesEntered(testInfo, 'TC-06-003 #3', values);
        await submitNewAddress(page, addressBook);
        const messages = await recordValidationMessages(page, testInfo, 'TC-06-003 #3');
        const afterOnAddressesPage = await addressBook.addressCards.count();
        await myAccount.goto();
        const counter = await myAccount.addressesLabel();
        await addressBook.goto();
        await testInfo.attach('Address counter after attempted save — TC-06-003 #3', { body: counter, contentType: 'text/plain' });

        expect.soft(afterOnAddressesPage, 'TC-06-003 #3: TPS expects save blocked (count unchanged); DEF-F6-05 contradicts this').toBe(before);
        expect.soft(messages.length, 'TC-06-003 #3: TPS expects a validation message identifying Address Line 1').toBeGreaterThan(0);
      });

      await test.step('TC-06-003 #4 — City empty: TPS expects blocked save (DEF-F6-05)', async () => {
        const values = {
          firstName: ACCOUNT_TEST_DATA.name.firstName,
          lastName: ACCOUNT_TEST_DATA.name.lastName,
          country: ACCOUNT_TEST_DATA.malaysiaAddress.country,
          province: ACCOUNT_TEST_DATA.malaysiaAddress.province,
          zip: ACCOUNT_TEST_DATA.malaysiaAddress.zip,
          address1: ACCOUNT_TEST_DATA.malaysiaAddress.address1,
        };
        const before = await addressBook.addressCards.count();
        await fillNewAddressForm(page, addressBook, values);
        await recordAddressValuesEntered(testInfo, 'TC-06-003 #4', values);
        await submitNewAddress(page, addressBook);
        const messages = await recordValidationMessages(page, testInfo, 'TC-06-003 #4');
        const afterOnAddressesPage = await addressBook.addressCards.count();
        await myAccount.goto();
        const counter = await myAccount.addressesLabel();
        await addressBook.goto();
        await testInfo.attach('Address counter after attempted save — TC-06-003 #4', { body: counter, contentType: 'text/plain' });

        expect.soft(afterOnAddressesPage, 'TC-06-003 #4: TPS expects save blocked (count unchanged); DEF-F6-05 contradicts this').toBe(before);
        expect.soft(messages.length, 'TC-06-003 #4: TPS expects a validation message identifying City').toBeGreaterThan(0);
      });

      await test.step('TC-06-003 #5 — Address1 whitespace-only: TPS expects treated as empty and blocked (DEF-F6-05)', async () => {
        const values = {
          firstName: ACCOUNT_TEST_DATA.name.firstName,
          lastName: ACCOUNT_TEST_DATA.name.lastName,
          country: ACCOUNT_TEST_DATA.malaysiaAddress.country,
          province: ACCOUNT_TEST_DATA.malaysiaAddress.province,
          zip: ACCOUNT_TEST_DATA.malaysiaAddress.zip,
          city: ACCOUNT_TEST_DATA.malaysiaAddress.city,
          address1: '   ',
        };
        const before = await addressBook.addressCards.count();
        await fillNewAddressForm(page, addressBook, values);
        await recordAddressValuesEntered(testInfo, 'TC-06-003 #5', values);
        await submitNewAddress(page, addressBook);
        const messages = await recordValidationMessages(page, testInfo, 'TC-06-003 #5');
        const afterOnAddressesPage = await addressBook.addressCards.count();
        await myAccount.goto();
        const counter = await myAccount.addressesLabel();
        await addressBook.goto();
        await testInfo.attach('Address counter after attempted save — TC-06-003 #5', { body: counter, contentType: 'text/plain' });

        expect.soft(afterOnAddressesPage, 'TC-06-003 #5: TPS expects save blocked (count unchanged); DEF-F6-05 contradicts this').toBe(before);
        expect.soft(messages.length, 'TC-06-003 #5: TPS expects a validation message').toBeGreaterThan(0);
      });

      await test.step('TC-06-003 #6 — City whitespace-only: TPS expects treated as empty and blocked (DEF-F6-05)', async () => {
        const values = {
          firstName: ACCOUNT_TEST_DATA.name.firstName,
          lastName: ACCOUNT_TEST_DATA.name.lastName,
          country: ACCOUNT_TEST_DATA.malaysiaAddress.country,
          province: ACCOUNT_TEST_DATA.malaysiaAddress.province,
          zip: ACCOUNT_TEST_DATA.malaysiaAddress.zip,
          address1: ACCOUNT_TEST_DATA.malaysiaAddress.address1,
          city: '   ',
        };
        const before = await addressBook.addressCards.count();
        await fillNewAddressForm(page, addressBook, values);
        await recordAddressValuesEntered(testInfo, 'TC-06-003 #6', values);
        await submitNewAddress(page, addressBook);
        const messages = await recordValidationMessages(page, testInfo, 'TC-06-003 #6');
        const afterOnAddressesPage = await addressBook.addressCards.count();
        await myAccount.goto();
        const counter = await myAccount.addressesLabel();
        await addressBook.goto();
        await testInfo.attach('Address counter after attempted save — TC-06-003 #6', { body: counter, contentType: 'text/plain' });

        expect.soft(afterOnAddressesPage, 'TC-06-003 #6: TPS expects save blocked (count unchanged); DEF-F6-05 contradicts this').toBe(before);
        expect.soft(messages.length, 'TC-06-003 #6: TPS expects a validation message').toBeGreaterThan(0);
      });

      await test.step('Reset — empty the address book before TC-06-004', async () => {
        await emptyAddressBook(page, addressBook);
        expect(await addressBook.addressCards.count()).toBe(0);
      });

      await test.step('TC-06-004 #1 — well-formed Malaysia postcode accepted and stored', async () => {
        const values = {
          firstName: ACCOUNT_TEST_DATA.name.firstName,
          lastName: ACCOUNT_TEST_DATA.name.lastName,
          country: ACCOUNT_TEST_DATA.malaysiaAddress.country,
          province: ACCOUNT_TEST_DATA.malaysiaAddress.province,
          address1: ACCOUNT_TEST_DATA.malaysiaAddress.address1,
          city: ACCOUNT_TEST_DATA.malaysiaAddress.city,
          zip: ACCOUNT_TEST_DATA.malaysiaAddress.zip,
        };
        const before = await addressBook.addressCards.count();
        await fillNewAddressForm(page, addressBook, values);
        await recordAddressValuesEntered(testInfo, 'TC-06-004 #1', values);
        await submitNewAddress(page, addressBook);

        expect(await addressBook.addressCards.count()).toBe(before + 1);
        expect(await addressBook.cardText(before).innerText()).toContain(ACCOUNT_TEST_DATA.malaysiaAddress.zip);
      });

      await test.step('TC-06-004 #2 — malformed postcode (TD-06-ZIPX) for Malaysia: TPS expects blocked at entry (DEF-F6-01)', async () => {
        const values = {
          firstName: ACCOUNT_TEST_DATA.name.firstName,
          lastName: ACCOUNT_TEST_DATA.name.lastName,
          country: ACCOUNT_TEST_DATA.malaysiaAddress.country,
          province: ACCOUNT_TEST_DATA.malaysiaAddress.province,
          address1: ACCOUNT_TEST_DATA.malaysiaAddress.address1,
          city: ACCOUNT_TEST_DATA.malaysiaAddress.city,
          zip: ACCOUNT_TEST_DATA.malformedMalaysiaZip,
        };
        const before = await addressBook.addressCards.count();
        await fillNewAddressForm(page, addressBook, values);
        await recordAddressValuesEntered(testInfo, 'TC-06-004 #2', values);
        await submitNewAddress(page, addressBook);
        const messages = await recordValidationMessages(page, testInfo, 'TC-06-004 #2');
        const afterOnAddressesPage = await addressBook.addressCards.count();
        await myAccount.goto();
        const counter = await myAccount.addressesLabel();
        await addressBook.goto();
        await testInfo.attach('Address counter after attempted save — TC-06-004 #2', { body: counter, contentType: 'text/plain' });

        expect.soft(afterOnAddressesPage, 'TC-06-004 #2: TPS expects save blocked at entry (count unchanged); DEF-F6-01 contradicts this').toBe(before);
        expect.soft(messages.length, 'TC-06-004 #2: TPS expects a validation message identifying the postcode format').toBeGreaterThan(0);
      });

      await test.step('TC-06-004 #3 — postcode empty for Malaysia: TPS expects blocked save (DEF-F6-05)', async () => {
        const values = {
          firstName: ACCOUNT_TEST_DATA.name.firstName,
          lastName: ACCOUNT_TEST_DATA.name.lastName,
          country: ACCOUNT_TEST_DATA.malaysiaAddress.country,
          province: ACCOUNT_TEST_DATA.malaysiaAddress.province,
          address1: ACCOUNT_TEST_DATA.malaysiaAddress.address1,
          city: ACCOUNT_TEST_DATA.malaysiaAddress.city,
        };
        const before = await addressBook.addressCards.count();
        await fillNewAddressForm(page, addressBook, values);
        await recordAddressValuesEntered(testInfo, 'TC-06-004 #3', values);
        await submitNewAddress(page, addressBook);
        const messages = await recordValidationMessages(page, testInfo, 'TC-06-004 #3');
        const afterOnAddressesPage = await addressBook.addressCards.count();
        await myAccount.goto();
        const counter = await myAccount.addressesLabel();
        await addressBook.goto();
        await testInfo.attach('Address counter after attempted save — TC-06-004 #3', { body: counter, contentType: 'text/plain' });

        expect.soft(afterOnAddressesPage, 'TC-06-004 #3: TPS expects save blocked (count unchanged); DEF-F6-05 contradicts this').toBe(before);
        expect.soft(messages.length, 'TC-06-004 #3: TPS expects a validation message identifying the missing postcode').toBeGreaterThan(0);
      });

      await test.step('TC-06-004 #4 — postcode whitespace-only for Malaysia: TPS expects treated as empty and blocked (DEF-F6-05)', async () => {
        const values = {
          firstName: ACCOUNT_TEST_DATA.name.firstName,
          lastName: ACCOUNT_TEST_DATA.name.lastName,
          country: ACCOUNT_TEST_DATA.malaysiaAddress.country,
          province: ACCOUNT_TEST_DATA.malaysiaAddress.province,
          address1: ACCOUNT_TEST_DATA.malaysiaAddress.address1,
          city: ACCOUNT_TEST_DATA.malaysiaAddress.city,
          zip: '   ',
        };
        const before = await addressBook.addressCards.count();
        await fillNewAddressForm(page, addressBook, values);
        await recordAddressValuesEntered(testInfo, 'TC-06-004 #4', values);
        await submitNewAddress(page, addressBook);
        const messages = await recordValidationMessages(page, testInfo, 'TC-06-004 #4');
        const afterOnAddressesPage = await addressBook.addressCards.count();
        await myAccount.goto();
        const counter = await myAccount.addressesLabel();
        await addressBook.goto();
        await testInfo.attach('Address counter after attempted save — TC-06-004 #4', { body: counter, contentType: 'text/plain' });

        expect.soft(afterOnAddressesPage, 'TC-06-004 #4: TPS expects save blocked (count unchanged); DEF-F6-05 contradicts this').toBe(before);
        expect.soft(messages.length, 'TC-06-004 #4: TPS expects a validation message').toBeGreaterThan(0);
      });

      await test.step('Reset — empty the address book before TC-06-005', async () => {
        await emptyAddressBook(page, addressBook);
        expect(await addressBook.addressCards.count()).toBe(0);
      });

      await test.step('TC-06-005 #1 — well-formed phone accepted and stored', async () => {
        const values = {
          firstName: ACCOUNT_TEST_DATA.name.firstName,
          lastName: ACCOUNT_TEST_DATA.name.lastName,
          country: ACCOUNT_TEST_DATA.malaysiaAddress.country,
          province: ACCOUNT_TEST_DATA.malaysiaAddress.province,
          address1: ACCOUNT_TEST_DATA.malaysiaAddress.address1,
          city: ACCOUNT_TEST_DATA.malaysiaAddress.city,
          zip: ACCOUNT_TEST_DATA.malaysiaAddress.zip,
          phone: ACCOUNT_TEST_DATA.malaysiaAddress.phone,
        };
        const before = await addressBook.addressCards.count();
        await fillNewAddressForm(page, addressBook, values);
        await recordAddressValuesEntered(testInfo, 'TC-06-005 #1', values);
        await submitNewAddress(page, addressBook);

        expect(await addressBook.addressCards.count()).toBe(before + 1);
        expect(await addressBook.cardText(before).innerText()).toContain(ACCOUNT_TEST_DATA.malaysiaAddress.phone);
      });

      await test.step('TC-06-005 #2 — Phone left empty, address saves with Phone blank', async () => {
        const values = {
          firstName: ACCOUNT_TEST_DATA.name.firstName,
          lastName: ACCOUNT_TEST_DATA.name.lastName,
          country: ACCOUNT_TEST_DATA.malaysiaAddress.country,
          province: ACCOUNT_TEST_DATA.malaysiaAddress.province,
          address1: ACCOUNT_TEST_DATA.malaysiaAddress.address1,
          city: ACCOUNT_TEST_DATA.malaysiaAddress.city,
          zip: ACCOUNT_TEST_DATA.malaysiaAddress.zip,
        };
        const before = await addressBook.addressCards.count();
        await fillNewAddressForm(page, addressBook, values);
        await recordAddressValuesEntered(testInfo, 'TC-06-005 #2', values);
        await submitNewAddress(page, addressBook);

        expect(await addressBook.addressCards.count()).toBe(before + 1);
      });

      await test.step('TC-06-005 #3 — Phone whitespace-only trimmed to empty, address saves', async () => {
        const values = {
          firstName: ACCOUNT_TEST_DATA.name.firstName,
          lastName: ACCOUNT_TEST_DATA.name.lastName,
          country: ACCOUNT_TEST_DATA.malaysiaAddress.country,
          province: ACCOUNT_TEST_DATA.malaysiaAddress.province,
          address1: ACCOUNT_TEST_DATA.malaysiaAddress.address1,
          city: ACCOUNT_TEST_DATA.malaysiaAddress.city,
          zip: ACCOUNT_TEST_DATA.malaysiaAddress.zip,
          phone: '   ',
        };
        const before = await addressBook.addressCards.count();
        await fillNewAddressForm(page, addressBook, values);
        await recordAddressValuesEntered(testInfo, 'TC-06-005 #3', values);
        await submitNewAddress(page, addressBook);

        // No defect log entry covers whitespace-trimming specifically —
        // asserted per the TPS as written. If this turns out wrong live, the
        // evidence (screenshot/attachment) still lands via withFailureEvidence.
        expect(await addressBook.addressCards.count()).toBe(before + 1);
      });

      await test.step('TC-06-005 #4 — Phone TD-06-PH1 (letters): TPS expects blocked at entry (DEF-F6-01)', async () => {
        const values = {
          firstName: ACCOUNT_TEST_DATA.name.firstName,
          lastName: ACCOUNT_TEST_DATA.name.lastName,
          country: ACCOUNT_TEST_DATA.malaysiaAddress.country,
          province: ACCOUNT_TEST_DATA.malaysiaAddress.province,
          address1: ACCOUNT_TEST_DATA.malaysiaAddress.address1,
          city: ACCOUNT_TEST_DATA.malaysiaAddress.city,
          zip: ACCOUNT_TEST_DATA.malaysiaAddress.zip,
          phone: ACCOUNT_TEST_DATA.phoneWithLetters,
        };
        const before = await addressBook.addressCards.count();
        await fillNewAddressForm(page, addressBook, values);
        await recordAddressValuesEntered(testInfo, 'TC-06-005 #4', values);
        await submitNewAddress(page, addressBook);
        const messages = await recordValidationMessages(page, testInfo, 'TC-06-005 #4');
        const afterOnAddressesPage = await addressBook.addressCards.count();
        await myAccount.goto();
        const counter = await myAccount.addressesLabel();
        await addressBook.goto();
        await testInfo.attach('Address counter after attempted save — TC-06-005 #4', { body: counter, contentType: 'text/plain' });

        expect.soft(afterOnAddressesPage, 'TC-06-005 #4: TPS expects save blocked at entry (count unchanged); DEF-F6-01 contradicts this').toBe(before);
        expect.soft(messages.length, 'TC-06-005 #4: TPS expects a validation message identifying the phone format').toBeGreaterThan(0);
      });

      await test.step('TC-06-005 #5 — Phone TD-06-PH2 (disallowed symbols): TPS expects blocked at entry (DEF-F6-01)', async () => {
        const values = {
          firstName: ACCOUNT_TEST_DATA.name.firstName,
          lastName: ACCOUNT_TEST_DATA.name.lastName,
          country: ACCOUNT_TEST_DATA.malaysiaAddress.country,
          province: ACCOUNT_TEST_DATA.malaysiaAddress.province,
          address1: ACCOUNT_TEST_DATA.malaysiaAddress.address1,
          city: ACCOUNT_TEST_DATA.malaysiaAddress.city,
          zip: ACCOUNT_TEST_DATA.malaysiaAddress.zip,
          phone: ACCOUNT_TEST_DATA.phoneWithSymbols,
        };
        const before = await addressBook.addressCards.count();
        await fillNewAddressForm(page, addressBook, values);
        await recordAddressValuesEntered(testInfo, 'TC-06-005 #5', values);
        await submitNewAddress(page, addressBook);
        const messages = await recordValidationMessages(page, testInfo, 'TC-06-005 #5');
        const afterOnAddressesPage = await addressBook.addressCards.count();
        await myAccount.goto();
        const counter = await myAccount.addressesLabel();
        await addressBook.goto();
        await testInfo.attach('Address counter after attempted save — TC-06-005 #5', { body: counter, contentType: 'text/plain' });

        expect.soft(afterOnAddressesPage, 'TC-06-005 #5: TPS expects save blocked at entry (count unchanged); DEF-F6-01 contradicts this').toBe(before);
        expect.soft(messages.length, 'TC-06-005 #5: TPS expects a validation message identifying the phone format').toBeGreaterThan(0);
      });

      await test.step('Wrap Up — empty the address book and sign out', async () => {
        await emptyAddressBook(page, addressBook);
        expect(await addressBook.addressCards.count()).toBe(0);
        await header.logOutLink.click();
        await page.waitForLoadState('domcontentloaded');
        await header.gotoHome();
      });
    });

    await context.close();
  });
});
