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
 * TP-06-001 — Verify the address form stores name values and falls back to
 * the account holder's name when they are empty, requires a country and a
 * subdivision where the country uses them, requires Address Line 1 and
 * City while leaving Address Line 2 and Company optional, validates the
 * postal code against the selected country, and treats the phone field as
 * optional but format constrained. Covers TC-06-001 through TC-06-005.
 *
 * THIS PROCEDURE IS EXPECTED TO REPORT "FAIL", AND THAT IS THE CORRECT
 * RESULT. Several sections assert outcomes the store does not deliver, so
 * the procedure genuinely does not pass — the Fail is cross-referenced to
 * the Defect Log in the test log's Remark column. (It previously called
 * test.fail(), which inverted the result and reported "passed" precisely
 * because it failed; that was wrong for a test log and has been removed.)
 *
 * The contradicted sections are soft-asserted rather than hard-asserted so
 * the run continues to the end and every observation is still captured —
 * a Fail here should come with the complete evidence set, not stop at the
 * first disagreement. Live capture (9 Aug) confirmed:
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
 * contradicting defect and are hard-asserted — if one of those fails, the
 * store has regressed somewhere new and the failure deserves a look at
 * exactly where it happened rather than being assumed to be one of the
 * defects above.
 *
 * TC-06-001 #1-3 (name fallback for empty/partial names) are hard-asserted
 * too — no defect covers those. TC-06-001 #4 (BOTH names whitespace-only)
 * is soft-asserted: confirmed live (9 Aug) that the save is blocked
 * entirely rather than falling back to the account holder's name as the
 * TPS describes. This isn't explained by DEF-F6-01/04/05 (those cover
 * country/subdivision/address/zip/phone, not name fields) — flagged as a
 * candidate new defect for the team's Defect Log, not yet confirmed there.
 * It now contributes to a recorded Fail, so it should be raised there.
 *
 * The account holder's name is read once at Set Up and used by TC-06-001
 * #2 and #3, which the TPS defines in terms of it ("no fallback applied" /
 * "the account holder's name is applied to both fields"). It is read from
 * the live account rather than bound in fixtures/test-data.ts because the
 * TPS means whichever account ENV-13 supplies — FN-06 has already been run
 * against two different accounts, and a hardcoded name silently stops
 * verifying anything as soon as the account changes.
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
    // Longest procedure in FN-06: five test cases, ~24 steps, and roughly
    // twenty address saves. Each save carries fillNewAddressForm's settle
    // waits (~3s, needed for the country/province race) on top of slowMo's
    // 600ms per action, and the Wrap Up then deletes every address the run
    // accumulated. Confirmed live 13 Aug: a full run reached TC-06-004 #4
    // at exactly 240s and was killed there, which also killed the context
    // mid-Wrap-Up and surfaced as "Target page, context or browser has been
    // closed" rather than as a timeout.
    test.setTimeout(600_000);

    const { context, page, header, addressBook, myAccount } = await startSignedInContext(browser, undefined, testInfo);
    let accountHolderName = '';

    try {
    await withFailureEvidence(page, testInfo, 'TP-06-001 unexpected failure', async () => {
      await test.step('Set Up — read the account holder name, empty the address book', async () => {
        // TC-06-001 #2 and #3 are both defined against this name, so it is
        // read from /account (where .customer-name renders) before the
        // address book work begins rather than mid-procedure.
        await myAccount.goto();
        accountHolderName = ((await myAccount.customerName.textContent().catch(() => null)) ?? '').trim();
        await testInfo.attach('Account holder name (ENV-13 account under test)', {
          body: accountHolderName || '(could not be read from /account)',
          contentType: 'text/plain',
        });
        expect(accountHolderName.length, 'account holder name must be readable — TC-06-001 #2/#3 are defined against it').toBeGreaterThan(0);

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
        await testInfo.attach('TC-06-001 #2 — stored card vs account holder name', {
          body: `account holder name: ${accountHolderName}\ncard text: ${cardText}`,
          contentType: 'text/plain',
        });
        expect(cardText).toContain(ACCOUNT_TEST_DATA.name.lastName);
        // "the empty field remains blank with no fallback applied" — checked
        // against the account holder's actual name, read at Set Up. This was
        // previously the hardcoded literal 'Dave', which verified nothing at
        // all once FN-06 started using a second account. Compared
        // case-insensitively for the same reason as #3 below.
        for (const part of accountHolderName.split(/\s+/).filter(Boolean)) {
          expect(cardText.toLowerCase(), `TC-06-001 #2: no fallback should be applied, but the card carries the account holder name part "${part}"`).not.toContain(part.toLowerCase());
        }
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
        await testInfo.attach('TC-06-001 #3 — account holder name vs card text', {
          body: `account holder name: ${accountHolderName}\ncard text: ${cardText}`,
          contentType: 'text/plain',
        });
        // The TPS requires the account holder's name to be applied to BOTH
        // fields. Each part is checked separately, since the card renders
        // first and last name together on one line.
        //
        // Case-insensitive: the store re-cases what it stores. Confirmed
        // live (13 Aug) — account holder "Dave dave" comes back on the card
        // as "Dave Dave", the same normalisation that renders "No. 5, Jalan
        // Universiti" as "No. 5, jalan universiti" and "Selangor" as "Sgr".
        // The fallback itself is applied correctly; only the casing differs,
        // so a case-sensitive check here would report a defect that is not
        // one. Matches how every other stored-value comparison in FN-06
        // handles this same normalisation.
        for (const part of accountHolderName.split(/\s+/).filter(Boolean)) {
          expect(cardText.toLowerCase(), `TC-06-001 #3: TPS expects the account holder name applied as fallback, but "${part}" is absent from the card`).toContain(part.toLowerCase());
        }
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
        await testInfo.attach('TC-06-002 #1 — stored address card', { body: cardText, contentType: 'text/plain' });
        expect(cardText).toContain('Malaysia');

        // The card renders the subdivision ABBREVIATED: "Selangor" is stored
        // and displayed as "Sgr" (confirmed live, 13 Aug). The TPS asks only
        // that "the selection is stored" — an abbreviated rendering of the
        // right state satisfies that, so accepting either form checks
        // storage rather than the theme's display format. Same reasoning as
        // the case-insensitive comparisons elsewhere in FN-06, which exist
        // because this store re-cases and reformats what it stores.
        const province = ACCOUNT_TEST_DATA.malaysiaAddress.province;
        const provinceShown = new RegExp(`${province}|Sgr`, 'i').test(cardText);
        expect(provinceShown, `TC-06-002 #1: card should carry the stored subdivision (${province}, rendered "Sgr" by this theme) — card read: ${cardText}`).toBe(true);
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

        // Diagnostics: TC-06-002 #1 saves this SAME address, so if the count
        // does not move here the open question is whether the save was
        // blocked (a message would say so) or whether the store silently
        // declines to create a second identical record. Recording both the
        // messages and the whole book distinguishes those two on sight
        // rather than leaving it to be inferred from a bare count.
        const messages = await recordValidationMessages(page, testInfo, 'TC-06-002 #3');
        const after = await addressBook.addressCards.count();
        const bookText = await addressBook.addressCards.allInnerTexts();
        await testInfo.attach('TC-06-002 #3 — address book after save', {
          body:
            `count before: ${before}\ncount after: ${after}\n` +
            `province options offered: ${provinceOptionCount}\n` +
            `validation messages: ${messages.length ? messages.join(' | ') : '(none displayed)'}\n\n` +
            `cards:\n${bookText.map((t, i) => `[${i}] ${t.replace(/\n/g, ' / ')}`).join('\n')}`,
          contentType: 'text/plain',
        });

        // CANDIDATE NEW DEFECT, confirmed live 13 Aug: submitting an address
        // identical to one already in the book creates no record AND shows no
        // message — count 1 before, 1 after, zero validation messages. The
        // shopper is given no indication the save did nothing. Not explained
        // by DEF-F6-01/04/05 and not in the team's Defect Log; raised here
        // with the evidence attached above.
        //
        // It is recorded rather than asserted, because it does not contradict
        // this step's expected result. The TPS asks only that "the subdivision
        // list is populated for the selected country and that the selection is
        // stored on the address record" — it does not ask for the counter
        // here, unlike #2 and #4, which say so explicitly. Asserting a count
        // increment would be stricter than the test basis.
        if (after === before) {
          await testInfo.attach('CANDIDATE DEFECT — duplicate address silently discarded (TC-06-002 #3)', {
            body:
              'An address identical to the one saved at TC-06-002 #1 was submitted. No new record was ' +
              'created and no validation message was shown, so the save failed silently.\n' +
              `count before: ${before}\ncount after: ${after}\nmessages: ${messages.length ? messages.join(' | ') : '(none)'}\n\n` +
              'Not asserted as a failure: TC-06-002 #3 requires the subdivision list to be populated and ' +
              'the selection stored on the address record, both of which hold. Raised for the Defect Log.',
            contentType: 'text/plain',
          });
        }

        expect(provinceOptionCount, 'TC-06-002 #3: subdivision list should be populated for Malaysia').toBeGreaterThan(1);
        // "Sgr" for the same reason as TC-06-002 #1 above. Checked across the
        // whole book rather than a fixed index, since the duplicate behaviour
        // above means the record may be the one saved at #1.
        const provinceStored = bookText.some((t) =>
          new RegExp(`${ACCOUNT_TEST_DATA.malaysiaAddress.province}|Sgr`, 'i').test(t),
        );
        expect(provinceStored, `TC-06-002 #3: the subdivision should be stored on an address record — book read: ${bookText.join(' || ')}`).toBe(true);
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

        // The phone is compared on digits alone, and soft. Two reasons, both
        // about the CARD rather than about storage: this store reformats what
        // it renders (confirmed live — "Selangor" shows as "Sgr", street
        // casing is rewritten), and Shopify's format_address, which renders
        // these cards, emits name/company/street/city/province/postcode/
        // country and does NOT include phone at all. So an exact-substring
        // check here can fail over a rendering choice while the number is
        // stored perfectly well. The card text is attached either way, which
        // is what SPR-20 actually asks for; tighten this to a hard assert
        // once a run confirms whether the card renders phone.
        const cardText = await addressBook.cardText(before).innerText();
        const digits = (s: string) => s.replace(/\D/g, '');
        await testInfo.attach('TC-06-005 #1 — stored address card (phone check)', {
          body: `phone entered: ${ACCOUNT_TEST_DATA.malaysiaAddress.phone}\ncard text:\n${cardText}`,
          contentType: 'text/plain',
        });
        expect.soft(
          digits(cardText).includes(digits(ACCOUNT_TEST_DATA.malaysiaAddress.phone)),
          'TC-06-005 #1: the stored phone number should appear on the address record — see attached card text for how this theme renders it',
        ).toBe(true);
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

        // Once the whitespace-only phone trims to empty, these values are
        // IDENTICAL to TC-06-005 #2's — and the store was confirmed live
        // (13 Aug, TC-06-002 #3) to silently discard a duplicate address:
        // no new record, no message. So this step is expected to find the
        // count unchanged.
        //
        // Unlike TC-06-002 #3, that IS a failure against the test basis
        // here: the TPS requires "the spaces are trimmed to empty and that
        // the address is saved". Soft-asserted so #4, #5 and the Wrap Up
        // still run — a Fail should arrive with the complete evidence set.
        const messages = await recordValidationMessages(page, testInfo, 'TC-06-005 #3');
        const after = await addressBook.addressCards.count();
        const bookText = await addressBook.addressCards.allInnerTexts();
        await testInfo.attach('TC-06-005 #3 — address book after save', {
          body:
            `count before: ${before}\ncount after: ${after}\n` +
            `validation messages: ${messages.length ? messages.join(' | ') : '(none displayed)'}\n\n` +
            'These values match TC-06-005 #2 exactly once the phone is trimmed. A silent no-op here ' +
            '(no record, no message) is the duplicate-address behaviour; a message would instead mean ' +
            'the whitespace phone itself was rejected.\n\n' +
            `cards:\n${bookText.map((t, i) => `[${i}] ${t.replace(/\n/g, ' / ')}`).join('\n')}`,
          contentType: 'text/plain',
        });

        expect.soft(after, 'TC-06-005 #3: TPS expects the whitespace phone trimmed and the address saved').toBe(before + 1);
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

    });
    } finally {
      await runWrapUp(testInfo, 'Wrap Up — empty the address book and sign out', async () => {
        await emptyAddressBook(page, addressBook);
        expect.soft(await addressBook.addressCards.count(), 'Wrap Up: address book should be empty').toBe(0);
        await header.logOutLink.click();
        await page.waitForLoadState('domcontentloaded');
        await header.gotoHome();
      });
      await closeContextWithVideo(context, page, testInfo, 'TP-06-001');
    }
  });
});
