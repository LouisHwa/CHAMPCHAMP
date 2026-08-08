import { Page, Locator } from '@playwright/test';

/**
 * /account/login — sign-in form, and on the same page the toggled
 * password-recovery form (#recover-password, hidden by default; shown
 * via forgotPasswordLink, or by navigating straight to
 * /account/login#recover per the page's own hash-check script). There
 * is no separate recovery URL.
 *
 * Both forms carry an invisible hCaptcha (data-cptcha="true"). CONFIRMED
 * as a hard automation blocker, not just a risk: submissions are rejected
 * from any browser Playwright drives — bundled Chromium and real Chrome
 * were both tested, in each case with a human solving the puzzle correctly
 * in the visible window. hCaptcha is detecting Chrome DevTools Protocol
 * attachment, which is how Playwright drives every browser, so no channel
 * avoids it.
 *
 * Procedures needing only a signed-in STARTING state should not use this
 * page — load a transplanted session instead, captured by hand:
 *   test.use({ storageState: 'playwright/.auth/user.json' });
 * or browser.newContext({ storageState }) where a procedure needs several
 * independent contexts. See docs/auth-setup-guide.md.
 *
 * Signing OUT needs no captcha and automates normally
 * (HeaderBar.logOutLink). Note though that a sign-out invalidates the
 * session SERVER-SIDE: a fresh context loading the same storageState file
 * afterwards is bounced back to this page, verified in
 * tests/_infra/auth-session.spec.ts. A saved session therefore cannot
 * stand in for a second sign-in later in the same procedure.
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
    await this.page.goto('/account/login', { waitUntil: 'domcontentloaded' });
  }
}
