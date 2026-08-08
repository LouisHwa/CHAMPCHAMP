import { test, expect } from '../../utils/pacedTest';
import { HeaderBar } from '../../pages/HeaderBar';
import { SidebarNav } from '../../pages/SidebarNav';
import { BlogPage } from '../../pages/BlogPage';
import { ROUTES } from '../../fixtures/test-data';
import { recordUrl } from '../../utils/evidence';

/**
 * TP-01-003 — Verify the blog lists posts, a post can be opened, and the
 * reader can return to the list. Covers TC-01-003 (#1 to #4).
 *
 * Intercase dependency: TP-01-001's Blog navigation step must have
 * resolved to the blog/news content page.
 *
 * Only one post ("First Post") currently exists, so "click the first
 * listed post title" always resolves to it — the recorded post list
 * attachment is what makes that visible if the catalogue ever changes.
 */
test.describe('FN-01 Product Browsing and Navigation', () => {
  test('TP-01-003 blog browsing', async ({ page }, testInfo) => {
    const header = new HeaderBar(page);
    const sidebar = new SidebarNav(page);
    const blog = new BlogPage(page);

    await test.step('Set Up — open the store home page', async () => {
      await header.gotoHome();
    });

    await test.step('TC-01-003 #1 — Blog link', async () => {
      await sidebar.blogLink.click();
      await recordUrl(page, testInfo, 'Blog');
      await expect(page).toHaveURL(new RegExp(`${ROUTES.blog}$`));
    });

    await test.step('TC-01-003 #2 — blog posts listed', async () => {
      const postTitles = await blog.posts.locator('h2').allTextContents();
      await testInfo.attach('Blog posts listed', {
        body: postTitles.join('\n'),
        contentType: 'text/plain',
      });
      expect(postTitles.length).toBeGreaterThan(0);
    });

    await test.step('TC-01-003 #3 — open first listed post', async () => {
      await blog.postTitleLink(0).click();
      await recordUrl(page, testInfo, 'First post');
      await expect(page).toHaveURL(/\/blogs\/news\/.+/);
    });

    await test.step('TC-01-003 #4 — Back to posts', async () => {
      await blog.backToPostsLink.click();
      await recordUrl(page, testInfo, 'Back to posts');
      await expect(page).toHaveURL(new RegExp(`${ROUTES.blog}$`));
    });

    await test.step('Wrap Up — return to the store home page', async () => {
      await header.gotoHome();
    });
  });
});
