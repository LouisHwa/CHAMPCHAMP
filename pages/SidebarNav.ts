import { Page, Locator } from '@playwright/test';

/**
 * The left sidebar: primary navigation (#main-menu) and the social/RSS
 * icon row (#social). This is the actual "global navigation" TP-01-001 to
 * TP-01-004 exercise, despite the TPS wording calling it header links.
 */
export class SidebarNav {
  readonly page: Page;
  readonly homeLink: Locator;
  readonly catalogLink: Locator;
  readonly blogLink: Locator;
  readonly aboutUsLink: Locator;
  readonly wishListLink: Locator;
  readonly referAFriendLink: Locator;
  readonly facebookIcon: Locator;
  readonly twitterIcon: Locator;
  readonly instagramIcon: Locator;
  readonly pinterestIcon: Locator;
  readonly rssIcon: Locator;

  constructor(page: Page) {
    this.page = page;
    const menu = page.locator('#main-menu');

    this.homeLink = menu.getByRole('link', { name: 'Home', exact: true });
    this.catalogLink = menu.getByRole('link', { name: 'Catalog', exact: true });
    this.blogLink = menu.getByRole('link', { name: 'Blog', exact: true });
    this.aboutUsLink = menu.getByRole('link', { name: 'About Us', exact: true });
    this.wishListLink = menu.getByRole('link', { name: 'Wish list', exact: true });
    this.referAFriendLink = menu.getByRole('link', { name: 'Refer a friend', exact: true });

    const social = page.locator('#social');
    this.facebookIcon = social.locator('a.facebook');
    this.twitterIcon = social.locator('a.twitter');
    this.instagramIcon = social.locator('a.instagram');
    this.pinterestIcon = social.locator('a.pinterest');
    this.rssIcon = social.locator('a.rss');
  }
}
