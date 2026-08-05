import { Page, Locator } from '@playwright/test';

/**
 * <header> only: search icon widget, utility links, minicart, logo.
 * Primary site navigation (Home/Catalog/Blog/About Us/Wish list/Refer a
 * friend) lives in the sidebar instead — see SidebarNav.ts.
 *
 * "About Us" and "Login"/"customer_login_link" also appear in the sidebar
 * and footer, so every locator here is scoped to `header` to avoid
 * Playwright strict-mode collisions.
 */
export class HeaderBar {
  readonly page: Page;
  readonly logo: Locator;
  readonly tagline: Locator;
  readonly searchField: Locator;
  readonly searchIconSubmit: Locator;
  readonly searchLink: Locator;
  readonly aboutUsLink: Locator;
  readonly logInLink: Locator;
  readonly signUpLink: Locator;
  readonly cartToggle: Locator;
  readonly cartCount: Locator;
  readonly checkoutLink: Locator;

  constructor(page: Page) {
    this.page = page;
    const header = page.locator('header');

    this.logo = page.locator('#logo a');
    this.tagline = page.locator('#tagline');

    this.searchField = page.locator('#search-field');
    this.searchIconSubmit = page.locator('#search-submit');

    this.searchLink = header.getByRole('link', { name: 'Search', exact: true });
    this.aboutUsLink = header.getByRole('link', { name: 'About Us', exact: true });
    this.logInLink = header.locator('#customer_login_link');
    this.signUpLink = header.locator('#customer_register_link');

    this.cartToggle = page.locator('#minicart a.toggle-drawer.cart.desktop');
    this.cartCount = page.locator('#cart-target-desktop');
    this.checkoutLink = page.locator('#minicart a.checkout');
  }

  async gotoHome() {
    await this.page.goto('/');
  }

  /** TC-03-001 etc: the magnifying-glass icon control, not the header/footer "Search" links. */
  async searchByIcon(term: string) {
    await this.searchField.fill(term);
    await this.searchIconSubmit.click();
  }
}
