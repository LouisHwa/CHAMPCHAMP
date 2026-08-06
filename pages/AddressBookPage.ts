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
 * NOT yet captured: the collapsed/read-only address card view (name +
 * address text with Edit/Delete/"Set as default" controls) that toggles
 * each edit form open — only the expanded edit forms have been seen so
 * far, not whatever triggers them.
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

  readonly existingAddressCards: Locator;

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

    this.existingAddressCards = page.locator('[id^="edit_address_"]');
  }

  async goto() {
    await this.page.goto('/account/addresses', { waitUntil: 'domcontentloaded' });
  }

  /** Scopes a field by its shared `name` within the nth existing address's edit form. */
  addressCardField(
    index: number,
    field: 'first_name' | 'last_name' | 'company' | 'address1' | 'address2' | 'city' | 'zip' | 'phone',
  ): Locator {
    return this.existingAddressCards.nth(index).locator(`input[name="address[${field}]"]`);
  }
}
