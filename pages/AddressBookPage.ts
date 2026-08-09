import { Page, Locator } from '@playwright/test';

/**
 * /account/addresses — address book, plus the "Add New Address" form
 * (#add_address, hidden until addNewAddressLink is clicked via
 * Shopify.CustomerAddress.toggleNewForm()).
 *
 * Bug in the live theme: the Company field's <input> has no `id` at all —
 * it carries a stray `for="address_company_new"` attribute (that belongs
 * on the <label>, copy-pasted onto the input by mistake). companyField
 * below locates by `name` scoped to newAddressForm, since every other
 * field has a proper id but this one doesn't.
 *
 * Every field's `name` (address[first_name], address[company], etc.) is
 * shared across the new-address form AND every existing address's edit
 * form, so all new-address locators are scoped to newAddressForm to
 * avoid matching the wrong one — a bare page.locator('input[name=...]')
 * would hit every address card on the page and throw a strict-mode error.
 *
 * Existing saved addresses use a per-address dynamic id suffix instead of
 * "_new" (e.g. edit_address_10456096407615) — never hardcode one; use
 * existingAddressCards / addressCardField(index, field) instead, which
 * scope by name within the nth card.
 *
 * Confirmed live (9 Aug capture): each saved address renders as one
 * `.address` block containing a view-mode `.vcard` (address text, with a
 * literal "(default)" prefix when it's the default) plus an `.actions`
 * paragraph with Edit/Delete links, and — nested in the same block — the
 * hidden edit form (`[id^="edit_address_"]`, what existingAddressCards
 * already pointed at). Edit calls `Shopify.CustomerAddress.toggleForm(id)`;
 * Delete calls `Shopify.CustomerAddress.destroy(id, "confirm text")`,
 * which raises a real `window.confirm()` dialog — callers must handle
 * `page.once('dialog', d => d.accept())` before clicking it. The
 * "Add New Address" form is also wrapped in a `.address`/`.vcard` (title
 * "Add a new address"), so addressCards below is filtered to blocks that
 * actually contain an edit form, which the new-address form is not.
 *
 * DEF-F6-02 confirmed live: opening Edit on a second address while a first
 * is already open leaves BOTH edit forms visible simultaneously — the site
 * does not enforce single-edit-mode itself; toggleForm only opens, it does
 * not close any other open form as a side effect.
 *
 * Country -> subdivision toggling is `Shopify.CountryProvinceSelector`,
 * which shows/hides `#address_province_container_new` (a <tr>) based on
 * the selected <option>'s `data-provinces` JSON. Confirmed live: United
 * Kingdom DOES carry subdivision data on this store (England, Northern
 * Ireland, Scotland, Wales, British Forces) — TD-06-UK's premise that UK
 * "does not use subdivisions" does not hold here; see tp-06-002's step for
 * TC-06-002 #5, which asserts the opposite of the TPS's literal wording
 * for that reason, per the team's own direction.
 *
 * DEF-F6-04/DEF-F6-05 confirmed live: submitting the new-address form with
 * Country left on its placeholder produces no visible error message and no
 * new address, AND — beyond what the defect log states — the page does a
 * full reload back to the (closed, empty) form rather than staying open
 * with the entered values retained. There is no validation-message element
 * to locate for a blocked save; its absence is itself the evidence.
 *
 * Confirmed live: with every address deleted, the address book renders no
 * empty-state message or element at all — just an empty `<p></p>` where
 * the cards would be. TC-06-006's "empty state" is therefore asserted as
 * addressCards having a count of zero, not as any specific locator/text.
 */
export class AddressBookPage {
  readonly page: Page;
  readonly returnToAccountLink: Locator;
  readonly addNewAddressLink: Locator;
  readonly newAddressForm: Locator;

  readonly firstNameField: Locator;
  readonly lastNameField: Locator;
  readonly companyField: Locator;
  readonly address1Field: Locator;
  readonly address2Field: Locator;
  readonly cityField: Locator;
  readonly countrySelect: Locator;
  readonly zipField: Locator;
  readonly phoneField: Locator;
  readonly setDefaultCheckbox: Locator;
  readonly addAddressButton: Locator;
  readonly cancelNewAddressLink: Locator;
  readonly provinceContainer: Locator;
  readonly provinceSelect: Locator;

  readonly existingAddressCards: Locator;
  readonly addressCards: Locator;

  constructor(page: Page) {
    this.page = page;
    this.returnToAccountLink = page.getByRole('link', { name: 'Return to Account Details' });
    this.addNewAddressLink = page.getByRole('link', { name: 'Add New Address' });
    this.newAddressForm = page.locator('#add_address');

    this.firstNameField = this.newAddressForm.locator('#address_first_name_new');
    this.lastNameField = this.newAddressForm.locator('#address_last_name_new');
    this.companyField = this.newAddressForm.locator('input[name="address[company]"]');
    this.address1Field = this.newAddressForm.locator('#address_address1_new');
    this.address2Field = this.newAddressForm.locator('#address_address2_new');
    this.cityField = this.newAddressForm.locator('#address_city_new');
    this.countrySelect = this.newAddressForm.locator('#address_country_new');
    this.zipField = this.newAddressForm.locator('#address_zip_new');
    this.phoneField = this.newAddressForm.locator('#address_phone_new');
    this.setDefaultCheckbox = this.newAddressForm.locator('#address_default_address_new');
    this.addAddressButton = this.newAddressForm.getByRole('button', { name: 'Add Address' });
    this.cancelNewAddressLink = this.newAddressForm.getByRole('link', { name: 'Cancel' });
    this.provinceContainer = this.newAddressForm.locator('#address_province_container_new');
    this.provinceSelect = this.newAddressForm.locator('#address_province_new');

    this.existingAddressCards = page.locator('[id^="edit_address_"]');
    // The new-address form is also a `.address` block, so this is filtered
    // to blocks that actually contain a saved address's edit form.
    this.addressCards = page.locator('.address').filter({ has: page.locator('[id^="edit_address_"]') });
  }

  async goto() {
    await this.page.goto('/account/addresses', { waitUntil: 'domcontentloaded' });
  }

  /**
   * Scopes a field by its shared `name` within the nth existing address's
   * edit form. `*[name=...]` rather than `input[name=...]` since province
   * is a <select>, not an <input>.
   */
  addressCardField(
    index: number,
    field: 'first_name' | 'last_name' | 'company' | 'address1' | 'address2' | 'city' | 'province' | 'zip' | 'phone' | 'default',
  ): Locator {
    return this.existingAddressCards.nth(index).locator(`*[name="address[${field}]"]`);
  }

  /** The view-mode address text (name/company/street/city/province/zip/country), "(default)" prefixed when default. */
  cardText(index: number): Locator {
    return this.addressCards.nth(index).locator('.vcard');
  }

  async isCardDefault(index: number): Promise<boolean> {
    const text = await this.cardText(index).innerText();
    return text.includes('(default)');
  }

  editLink(index: number): Locator {
    return this.addressCards.nth(index).locator('.actions').getByRole('link', { name: 'Edit' });
  }

  /** Raises a real window.confirm() — call page.once('dialog', d => d.accept()) before clicking. */
  deleteLink(index: number): Locator {
    return this.addressCards.nth(index).locator('.actions').getByRole('link', { name: 'Delete' });
  }

  isEditFormOpen(index: number): Promise<boolean> {
    return this.existingAddressCards.nth(index).isVisible();
  }

  cancelEditLink(index: number): Locator {
    return this.existingAddressCards.nth(index).getByRole('link', { name: 'Cancel' });
  }

  saveEditButton(index: number): Locator {
    return this.existingAddressCards.nth(index).getByRole('button', { name: 'Update Address' });
  }
}
