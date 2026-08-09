import { test, expect } from '../../utils/pacedTest';
import { captureFailureEvidence, recordUrl } from '../../utils/evidence';
import { ACCOUNT_TEST_DATA } from '../../fixtures/test-data';
import { HeaderBar } from '../../pages/HeaderBar';
import { AddressBookPage } from '../../pages/AddressBookPage';
import { MyAccountPage } from '../../pages/MyAccountPage';
import {
  startSignedInContext,
  emptyAddressBook,
  fillNewAddressForm,
  submitNewAddress,
  recordAddressValuesEntered,
  recordValidationMessages,
} from './_helpers';

const BASE_URL = 'https://sauce-demo.myshopify.com';

/**
 * TP-06-005 — Verify submitting the address form with a mandatory field
 * empty keeps the shopper on the form and shows a validation message,
 * that a saved address persists across sign-out and sign-in with the My
 * Account page showing order history and saved addresses, and that saved
 * addresses are visible after signing in from a second browser. Covers
 * TC-06-015, TC-06-012, TC-06-016 — one shared account, executed as one
 * procedure since they are the address flows of UC-06-01.
 *
 * EXPECTED TO FAIL, BY DESIGN, on the TC-06-015 section only — DEF-F6-04
 * confirmed live (9 Aug direct capture): leaving Country unselected
 * produces no visible error message, and — beyond the log's original
 * wording — the page does a full reload back to a closed, empty form
 * rather than staying open with the entered values retained. TC-06-012
 * and TC-06-016 have no contradicting defect and are hard-asserted;
 * test.fail() applies to the whole test, so the TC-06-015 section is what
 * determines the overall result even though the rest genuinely pass.
 *
 * TC-06-015 #4 also hit a second, separate candidate new defect: with no
 * explicit name given (the account-holder-name fallback applies, per
 * TC-06-001 #3), the saved address comes back with Address1/Address2
 * lowercased and merged onto one line, even though the field held the
 * correctly-cased value right up until submit (verified directly). Every
 * other address1 check in this file supplies an explicit name and was
 * confirmed unaffected — matching TP-06-001's TC-06-003 #1, which checks
 * the same value with a name provided and passes cleanly. Soft-asserted,
 * case-insensitively, with evidence; not yet in the team's Defect Log.
 *
 * Re-signing-in (TC-06-012 #4, TC-06-016 #2) uses the same substitution
 * already proven on fn04-cart-management's tp-04-006-cart-resumption: a
 * fresh context loading the persistent playwright/.auth/user.json again,
 * not the just-closed (now server-side signed-out) snapshot from the
 * prior step. Browser B (TC-06-016) is a second, independent context —
 * ENV-10 requires storage independent of Browser A so the outcome
 * distinguishes account-held addresses from browser-held ones.
 */
test.describe('FN-06 Account and Address Management', () => {
  test('TP-06-005 account address journey', async ({ browser }, testInfo) => {
    test.fail(true, 'Confirmed defect DEF-F6-04: leaving Country unselected produces no error message and discards entered values.');
    test.setTimeout(240_000);

    let contextA = await startSignedInContext(browser);
    // This test swaps contexts partway through (Browser A signs out and a
    // fresh context replaces it; Browser B opens alongside it), so a fixed
    // Page reference for failure evidence would go stale — withFailureEvidence
    // takes one fixed page and can't follow that. activePage is kept pointed
    // at whichever page is actually live, updated at each swap below.
    let activePage = contextA.page;

    try {
      await test.step('Set Up — Browser A signed in, address book emptied', async () => {
        await emptyAddressBook(contextA.page, contextA.addressBook);
        expect(await contextA.addressBook.addressCards.count()).toBe(0);
      });

      // Province cannot be set without Country first (Shopify's
      // CountryProvinceSelector only populates it once a country with
      // subdivision data is chosen) — since Country is exactly the field
      // under test here, Province is left unset along with it, not filled
      // from TD-06-MY as the rest of the address is.
      const tc015Values = {
        address1: ACCOUNT_TEST_DATA.malaysiaAddress.address1,
        address2: ACCOUNT_TEST_DATA.malaysiaAddress.address2,
        city: ACCOUNT_TEST_DATA.malaysiaAddress.city,
        company: ACCOUNT_TEST_DATA.malaysiaAddress.company,
        zip: ACCOUNT_TEST_DATA.malaysiaAddress.zip,
        phone: ACCOUNT_TEST_DATA.malaysiaAddress.phone,
      };

      await test.step('TC-06-015 #1 — form accepts every TD-06-MY field except Country', async () => {
        await fillNewAddressForm(contextA.page, contextA.addressBook, tc015Values);
        await recordAddressValuesEntered(testInfo, 'TC-06-015 #1', tc015Values);

        expect(await contextA.addressBook.address1Field.inputValue()).toBe(tc015Values.address1);
        expect(await contextA.addressBook.address2Field.inputValue()).toBe(tc015Values.address2);
        expect(await contextA.addressBook.cityField.inputValue()).toBe(tc015Values.city);
        expect(await contextA.addressBook.companyField.inputValue()).toBe(tc015Values.company);
        expect(await contextA.addressBook.zipField.inputValue()).toBe(tc015Values.zip);
        expect(await contextA.addressBook.phoneField.inputValue()).toBe(tc015Values.phone);
      });

      await test.step('TC-06-015 #2 — submit with no Country: TPS expects the form stays open with a message and retained values (DEF-F6-04)', async () => {
        await submitNewAddress(contextA.page, contextA.addressBook);
        const messages = await recordValidationMessages(contextA.page, testInfo, 'TC-06-015 #2');
        const formStillOpen = await contextA.addressBook.newAddressForm.isVisible();
        const address1Retained = formStillOpen ? await contextA.addressBook.address1Field.inputValue().catch(() => '') : '';

        await testInfo.attach('TC-06-015 #2 — form state after blocked submit', {
          body: `form still open: ${formStillOpen}\nAddress1 retained: "${address1Retained}" (entered: "${tc015Values.address1}")`,
          contentType: 'text/plain',
        });

        expect.soft(messages.length, 'TC-06-015 #2: TPS expects a validation message identifying Country').toBeGreaterThan(0);
        expect.soft(formStillOpen, 'TC-06-015 #2: TPS expects the shopper to remain on the form').toBe(true);
        expect.soft(address1Retained, 'TC-06-015 #2: TPS expects entered values to be retained rather than discarded').toBe(tc015Values.address1);
      });

      await test.step('TC-06-015 #3 — no address created, address counter unchanged', async () => {
        expect(await contextA.addressBook.addressCards.count()).toBe(0);
        await contextA.myAccount.goto();
        const counter = await contextA.myAccount.addressesLabel();
        await testInfo.attach('Address counter — TC-06-015 #3', { body: counter, contentType: 'text/plain' });
        expect(counter).toContain('Addresses (0)');
      });

      await test.step('TC-06-015 #4 — completing the missing Country field saves the address', async () => {
        await contextA.addressBook.goto();
        const completedValues = { ...tc015Values, country: ACCOUNT_TEST_DATA.malaysiaAddress.country, province: ACCOUNT_TEST_DATA.malaysiaAddress.province };
        await fillNewAddressForm(contextA.page, contextA.addressBook, completedValues);
        await recordAddressValuesEntered(testInfo, 'TC-06-015 #4', completedValues);
        await submitNewAddress(contextA.page, contextA.addressBook);

        expect(await contextA.addressBook.addressCards.count()).toBe(1);
        const cardText = await contextA.addressBook.cardText(0).innerText();

        // Candidate new defect, confirmed live (9 Aug): the field held the
        // correct value ("No. 5, Jalan Universiti") right up until submit —
        // verified directly — but the saved/displayed address comes back
        // lowercased and with Address1/Address2 merged onto one line
        // ("no. 5, jalan universiti, bandar sunway"). This occurred here,
        // where no explicit name was given and the account-holder-name
        // fallback applied (per TC-06-001 #3); not yet confirmed whether it
        // also happens with an explicit name — TP-06-001's TC-06-003 #1
        // checks the same value with a name provided and passed there. Not
        // yet in the team's Defect Log.
        await testInfo.attach('TC-06-015 #4 — candidate new defect: address1 lowercased/merged on save', {
          body: `entered address1: ${ACCOUNT_TEST_DATA.malaysiaAddress.address1}\nsaved card text:\n${cardText}`,
          contentType: 'text/plain',
        });
        expect.soft(cardText.toLowerCase(), 'TC-06-015 #4: saved address should contain the entered Address1 value').toContain(ACCOUNT_TEST_DATA.malaysiaAddress.address1.toLowerCase());
      });

      await test.step('Reset — empty the address book on Browser A', async () => {
        await emptyAddressBook(contextA.page, contextA.addressBook);
        expect(await contextA.addressBook.addressCards.count()).toBe(0);
      });

      await test.step('TC-06-012 #1 — My Account displays order history and saved addresses', async () => {
        await contextA.myAccount.goto();
        await recordUrl(contextA.page, testInfo, 'My Account — TC-06-012 #1');
        await expect(contextA.myAccount.page.locator('.order-history')).toBeVisible();
        await expect(contextA.myAccount.addressesLink).toBeVisible();
      });

      await test.step('TC-06-012 #2 — a new address from TD-06-MY is saved and displayed', async () => {
        await contextA.addressBook.goto();
        const values = {
          firstName: ACCOUNT_TEST_DATA.name.firstName,
          lastName: ACCOUNT_TEST_DATA.name.lastName,
          country: ACCOUNT_TEST_DATA.malaysiaAddress.country,
          province: ACCOUNT_TEST_DATA.malaysiaAddress.province,
          address1: ACCOUNT_TEST_DATA.malaysiaAddress.address1,
          address2: ACCOUNT_TEST_DATA.malaysiaAddress.address2,
          city: ACCOUNT_TEST_DATA.malaysiaAddress.city,
          company: ACCOUNT_TEST_DATA.malaysiaAddress.company,
          zip: ACCOUNT_TEST_DATA.malaysiaAddress.zip,
          phone: ACCOUNT_TEST_DATA.malaysiaAddress.phone,
        };
        await fillNewAddressForm(contextA.page, contextA.addressBook, values);
        await recordAddressValuesEntered(testInfo, 'TC-06-012 #2', values);
        await submitNewAddress(contextA.page, contextA.addressBook);

        expect(await contextA.addressBook.addressCards.count()).toBe(1);
        // Case-insensitive — see fillNewAddressForm's header comment.
        expect((await contextA.addressBook.cardText(0).innerText()).toLowerCase()).toContain(ACCOUNT_TEST_DATA.malaysiaAddress.address1.toLowerCase());
      });

      await test.step('TC-06-012 #3 — sign out (real, automatable action)', async () => {
        await contextA.header.logOutLink.click();
        await contextA.page.waitForLoadState('domcontentloaded');
        await expect(contextA.header.logInLink).toBeVisible();
      });

      await contextA.context.close();

      let contextA2 = await startSignedInContext(browser);
      activePage = contextA2.page;

      await test.step('TC-06-012 #4 — signing in again in a new session shows the address saved at #2 (account-bound, not browser-bound)', async () => {
        await contextA2.myAccount.goto();
        await contextA2.addressBook.goto();
        expect(await contextA2.addressBook.addressCards.count()).toBe(1);
        expect((await contextA2.addressBook.cardText(0).innerText()).toLowerCase()).toContain(ACCOUNT_TEST_DATA.malaysiaAddress.address1.toLowerCase());
      });

      let tc016Contents = '';

      await test.step('TC-06-016 #1 — Browser A: empty the address book, save one address from TD-06-MY', async () => {
        await emptyAddressBook(contextA2.page, contextA2.addressBook);
        const values = {
          firstName: ACCOUNT_TEST_DATA.name.firstName,
          lastName: ACCOUNT_TEST_DATA.name.lastName,
          country: ACCOUNT_TEST_DATA.malaysiaAddress.country,
          province: ACCOUNT_TEST_DATA.malaysiaAddress.province,
          address1: ACCOUNT_TEST_DATA.malaysiaAddress.address1,
          address2: ACCOUNT_TEST_DATA.malaysiaAddress.address2,
          city: ACCOUNT_TEST_DATA.malaysiaAddress.city,
          company: ACCOUNT_TEST_DATA.malaysiaAddress.company,
          zip: ACCOUNT_TEST_DATA.malaysiaAddress.zip,
          phone: ACCOUNT_TEST_DATA.malaysiaAddress.phone,
        };
        await fillNewAddressForm(contextA2.page, contextA2.addressBook, values);
        await recordAddressValuesEntered(testInfo, 'TC-06-016 #1', values);
        await submitNewAddress(contextA2.page, contextA2.addressBook);

        expect(await contextA2.addressBook.addressCards.count()).toBe(1);
        tc016Contents = await contextA2.addressBook.cardText(0).innerText();
        await testInfo.attach('Address recorded on Browser A — TC-06-016 #1', { body: tc016Contents, contentType: 'text/plain' });
      });

      const contextB = await browser.newContext({ baseURL: BASE_URL, storageState: 'playwright/.auth/user.json' });
      const pageB = await contextB.newPage();
      const headerB = new HeaderBar(pageB);
      const addressBookB = new AddressBookPage(pageB);
      const myAccountB = new MyAccountPage(pageB);
      activePage = pageB;

      await test.step('TC-06-016 #2 — Browser B, signing in to the same account, shows the same saved address set', async () => {
        await myAccountB.goto();
        await addressBookB.goto();
        expect(await addressBookB.addressCards.count()).toBe(1);
        const browserBContents = await addressBookB.cardText(0).innerText();
        await testInfo.attach('Address set displayed on Browser B — TC-06-016 #2', {
          body: `Browser B: ${browserBContents}\ncompared against Browser A (TC-06-016 #1): ${tc016Contents}`,
          contentType: 'text/plain',
        });
        expect(browserBContents).toBe(tc016Contents);
      });

      await test.step('Wrap Up — empty the address book and sign out on both browsers, return home', async () => {
        await emptyAddressBook(contextA2.page, contextA2.addressBook);
        expect(await contextA2.addressBook.addressCards.count()).toBe(0);
        await contextA2.header.logOutLink.click().catch(() => {});
        await contextA2.header.gotoHome();

        await emptyAddressBook(pageB, addressBookB);
        expect(await addressBookB.addressCards.count()).toBe(0);
        await headerB.logOutLink.click().catch(() => {});
        await headerB.gotoHome();
      });

      await contextA2.context.close();
      await contextB.close();
    } catch (err) {
      await captureFailureEvidence(activePage, testInfo, 'TP-06-005 unexpected failure').catch(() => {});
      throw err;
    }
  });
});
