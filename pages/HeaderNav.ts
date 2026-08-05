import { Page, Locator } from '@playwright/test';

/**
 * Global header used across FN-01 Product Browsing and Navigation.
 * All selectors live here so a theme change touches one file only.
 *
 * NOTE: several link texts ("About Us", "Search") appear more than once
 * on the page (top bar, main menu, footer). Playwright's strict mode
 * errors on multiple matches, so .first() is used below. Once you have
 * inspected the DOM, replace .first() with a scoped container locator
 * such as page.locator('#nav').getByRole(...) — that is more precise
 * and survives layout changes better.
 */
export class HeaderNav {
  readonly page: Page;
  readonly storeLogo: Locator;
  readonly homeLink: Locator;
  readonly catalogLink: Locator;
  readonly blogLink: Locator;
  readonly aboutUsLink: Locator;
  readonly wishListLink: Locator;
  readonly referAFriendLink: Locator;
  readonly searchLink: Locator;
  readonly logInLink: Locator;
  readonly signUpLink: Locator;
  readonly cartLink: Locator;

  constructor(page: Page) {
    this.page = page;
    this.storeLogo = page.locator('h1 a').first();
    this.homeLink = page.getByRole('link', { name: 'Home', exact: true }).first();
    this.catalogLink = page.getByRole('link', { name: 'Catalog', exact: true }).first();
    this.blogLink = page.getByRole('link', { name: 'Blog', exact: true }).first();
    this.aboutUsLink = page.getByRole('link', { name: 'About Us', exact: true }).first();
    this.wishListLink = page.getByRole('link', { name: 'Wish list', exact: true }).first();
    this.referAFriendLink = page.getByRole('link', { name: 'Refer a friend', exact: true }).first();
    this.searchLink = page.getByRole('link', { name: 'Search', exact: true }).first();
    this.logInLink = page.getByRole('link', { name: /log ?in/i }).first();
    this.signUpLink = page.getByRole('link', { name: /sign up|create account/i }).first();
    this.cartLink = page.getByRole('link', { name: /my cart/i }).last();
  }

  async gotoHome() {
    await this.page.goto('/');
  }
}
