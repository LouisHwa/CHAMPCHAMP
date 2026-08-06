import { Page, Locator } from '@playwright/test';

/**
 * /account/register — account creation form.
 *
 * The theme markup gives each field's wrapping <div> the same id as its
 * <input> (e.g. <div id="email"><input id="email">), which is invalid
 * HTML but present on the live site. Locators below use the `input#id`
 * type+id form to disambiguate — plain `#id` would match both elements
 * and throw a Playwright strict-mode error.
 */
export class RegisterPage {
  readonly page: Page;
  readonly firstNameField: Locator;
  readonly lastNameField: Locator;
  readonly emailField: Locator;
  readonly passwordField: Locator;
  readonly createButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.firstNameField = page.locator('input#first_name');
    this.lastNameField = page.locator('input#last_name');
    this.emailField = page.locator('input#email');
    this.passwordField = page.locator('input#password');
    this.createButton = page.locator('#create_customer input[type="submit"]');
  }

  async goto() {
    await this.page.goto('/account/register', { waitUntil: 'domcontentloaded' });
  }
}
