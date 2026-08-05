import { Page, Locator } from '@playwright/test';

/**
 * /account/login — sign-in form, and on the same page the toggled
 * password-recovery form (#recover-password, hidden by default; shown
 * via forgotPasswordLink, or by navigating straight to
 * /account/login#recover per the page's own hash-check script). There
 * is no separate recovery URL.
 *
 * Both forms carry an invisible hCaptcha (data-cptcha="true") — flag as
 * a possible automation risk if a submission ever gets silently blocked
 * in CI; hasn't shown up as an issue in manual testing so far.
 */
export class LoginPage {
  readonly page: Page;

  readonly emailField: Locator;
  readonly passwordField: Locator;
  readonly signInButton: Locator;
  readonly forgotPasswordLink: Locator;

  readonly recoverEmailField: Locator;
  readonly recoverSubmitButton: Locator;
  readonly recoverCancelLink: Locator;

  constructor(page: Page) {
    this.page = page;

    this.emailField = page.locator('#customer_email');
    this.passwordField = page.locator('#customer_password');
    this.signInButton = page.locator('#customer_login input[type="submit"]');
    this.forgotPasswordLink = page.getByRole('link', { name: 'Forgot your password?' });

    this.recoverEmailField = page.locator('#recover-email');
    this.recoverSubmitButton = page.locator('#recover-password input[type="submit"]');
    this.recoverCancelLink = page.locator('#recover-password').getByRole('link', { name: 'Cancel' });
  }

  async goto() {
    await this.page.goto('/account/login');
  }
}
