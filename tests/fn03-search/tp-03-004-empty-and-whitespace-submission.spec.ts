import { test, expect } from '../../utils/pacedTest';
import { HeaderBar } from '../../pages/HeaderBar';
import { SearchResultsPage } from '../../pages/SearchResultsPage';
import { recordUrl } from '../../utils/evidence';

/**
 * TP-03-004 — Verify an empty or whitespace-only query does not run a
 * catalogue query. Covers TC-03-004 (#1 to #3).
 *
 * The objective states an unambiguous expected outcome (no query runs),
 * so both submissions hard-assert the no-query-run placeholder state
 * rather than treating the result as ambiguous evidence.
 */
test.describe('FN-03 Product Search', () => {
  test('TP-03-004 empty and whitespace-only submission', async ({ page }, testInfo) => {
    const header = new HeaderBar(page);
    const search = new SearchResultsPage(page);

    await test.step('Set Up — open the store home page', async () => {
      await header.gotoHome();
    });

    await test.step('TC-03-004 #1 / #3 — empty submission via search icon', async () => {
      await header.searchByIcon('');
      const url = await recordUrl(page, testInfo, 'Empty submission');
      const messageText = await search.heading.locator('xpath=following-sibling::*[1]').textContent().catch(() => null);
      await testInfo.attach('Empty submission — system response', {
        body: `destination: ${url}\nresponse: ${messageText?.trim() ?? '(see noQueryMessage assertion)'}`,
        contentType: 'text/plain',
      });

      await expect(search.noQueryMessage).toBeVisible();
      await expect(search.keywordBanner).not.toBeVisible();
      await expect(search.grid).toHaveCount(0);
    });

    await test.step('TC-03-004 #2 / #3 — whitespace-only submission via search icon', async () => {
      await header.gotoHome();
      await header.searchByIcon(' ');
      const url = await recordUrl(page, testInfo, 'Whitespace-only submission');
      await testInfo.attach('Whitespace-only submission — system response', {
        body: `destination: ${url}`,
        contentType: 'text/plain',
      });

      await expect(search.noQueryMessage).toBeVisible();
      await expect(search.keywordBanner).not.toBeVisible();
      await expect(search.grid).toHaveCount(0);
    });

    await test.step('Wrap Up — return to the store home page', async () => {
      await header.gotoHome();
    });
  });
});
