import { Page, Locator } from '@playwright/test';

/**
 * /blogs/news — post list, and the individual post page reached from it.
 * Only one post currently exists ("First Post"), so TP-01-003's "click
 * the first listed post title" always resolves to it. On the post page
 * itself the breadcrumb gains a segment ("Home — News — First Post") and
 * "Back to posts" lives at .actions .back a.
 */
export class BlogPage {
  readonly page: Page;
  readonly posts: Locator;
  readonly backToPostsLink: Locator;

  constructor(page: Page) {
    this.page = page;
    this.posts = page.locator('article.post');
    this.backToPostsLink = page.locator('.actions .back a');
  }

  async goto() {
    await this.page.goto('/blogs/news', { waitUntil: 'domcontentloaded' });
  }

  postTitleLink(index = 0): Locator {
    return this.posts.nth(index).locator('h2 a');
  }
}
