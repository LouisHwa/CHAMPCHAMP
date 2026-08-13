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

    // The Wrap Up has to attach "the recorded post list and destination
    // URLs", so each step keeps what it observed rather than only
    // attaching it in isolation.
    const destinations: string[] = [];
    let postList: string[] = [];

    await test.step('Set Up — confirm preconditions, open the store home page', async () => {
      await header.gotoHome();
      destinations.push(`Set Up (home): ${await recordUrl(page, testInfo, 'home page')}`);

      // ENV-01: fresh context per test, so cache and cookies start empty.
      // The TPS also asks to confirm no shopper account is signed in.
      const signedOut = await header.logInLink.isVisible().catch(() => false);

      // ENV-05 (blog holds at least one published post) is confirmed at
      // TC-01-003 #2 below, which records the list and asserts it is
      // non-empty — the blog cannot be reached to count posts until #1 has
      // navigated to it, so the confirmation lands there rather than here.
      await testInfo.attach('Set Up — preconditions', {
        body: [
          `ENV-01 — "Log In" control visible (i.e. no shopper signed in): ${signedOut}`,
          'ENV-05 — blog holds at least one published post: confirmed at TC-01-003 #2,',
          'which records the post list and asserts it is non-empty.',
          'Intercase dependency: TP-01-001 must have been executed with its "Blog"',
          'navigation step resolving to the blog or news content page. Run tp-01-001',
          'before this procedure. TC-01-003 #1 below exercises the same control, so',
          'the dependency is re-established rather than assumed.',
        ].join('\n'),
        contentType: 'text/plain',
      });
      expect(signedOut, 'ENV-01: no shopper account should be signed in at Set Up').toBe(true);
    });

    await test.step('TC-01-003 #1 — Blog link', async () => {
      await sidebar.blogLink.click();
      destinations.push(`Blog [#1]: ${await recordUrl(page, testInfo, 'Blog')}`);
      await expect(page).toHaveURL(new RegExp(`${ROUTES.blog}$`));
    });

    await test.step('TC-01-003 #2 — blog posts listed', async () => {
      const postTitles = await blog.posts.locator('h2').allTextContents();
      postList = postTitles;
      await testInfo.attach('Blog posts listed', {
        body: postTitles.join('\n'),
        contentType: 'text/plain',
      });
      // Also discharges ENV-05.
      expect(postTitles.length, 'ENV-05: the blog should hold at least one published post').toBeGreaterThan(0);
    });

    await test.step('TC-01-003 #3 — open first listed post', async () => {
      await blog.postTitleLink(0).click();
      destinations.push(`First listed post [#3]: ${await recordUrl(page, testInfo, 'First post')}`);
      await expect(page).toHaveURL(/\/blogs\/news\/.+/);
    });

    await test.step('TC-01-003 #4 — Back to posts', async () => {
      await blog.backToPostsLink.click();
      destinations.push(`Back to posts [#4]: ${await recordUrl(page, testInfo, 'Back to posts')}`);
      await expect(page).toHaveURL(new RegExp(`${ROUTES.blog}$`));
    });

    await test.step('Wrap Up — return to the store home page, attach the recorded results', async () => {
      await header.gotoHome();
      destinations.push(`Wrap Up (home): ${await recordUrl(page, testInfo, 'Wrap Up — store home page')}`);

      // TPS Wrap Up: attach the recorded post list and destination URLs.
      await testInfo.attach('TP-01-003 Wrap Up — recorded results', {
        body: [
          'DESTINATION URLs RECORDED',
          ...destinations.map((d) => `  ${d}`),
          '',
          `BLOG POSTS LISTED (${postList.length})`,
          ...(postList.length ? postList.map((t) => `  ${t}`) : ['  (none recorded)']),
        ].join('\n'),
        contentType: 'text/plain',
      });
    });
  });
});
