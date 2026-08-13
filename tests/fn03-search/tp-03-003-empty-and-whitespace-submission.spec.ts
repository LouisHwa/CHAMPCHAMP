import type { Page, TestInfo } from '@playwright/test';
import { test, expect } from '../../utils/pacedTest';
import { HeaderBar } from '../../pages/HeaderBar';
import { SearchResultsPage } from '../../pages/SearchResultsPage';
import { SEARCH_TERMS } from '../../fixtures/test-data';
import { recordUrl } from '../../utils/evidence';

/** The three confirmed /search states — see SearchResultsPage.ts. */
type ResultsAreaState =
  | 'no query was run'
  | 'query executed, no matching products'
  | 'query executed, products returned'
  | 'neither';

/**
 * Records the results area the way TP-03-002 does: the message text
 * verbatim, a screenshot of the area, and which of the three confirmed
 * /search states was displayed (SPR-10).
 *
 * Both submissions in this procedure need the identical treatment, so it
 * lives here rather than being written out twice. The state is DERIVED
 * from the page rather than assumed: "no query was run" and "query
 * executed and returned no matching products" are different findings and
 * SPR-10 requires the distinction to be recorded, not inferred by
 * whoever reads the report.
 */
async function recordResultsArea(
  page: Page,
  testInfo: TestInfo,
  search: SearchResultsPage,
  label: string,
): Promise<ResultsAreaState> {
  const [noQueryVisible, bannerVisible] = await Promise.all([
    search.noQueryMessage.isVisible(),
    search.keywordBanner.isVisible(),
  ]);
  const bannerText = bannerVisible ? (await search.keywordBanner.textContent())?.trim() ?? '' : '';
  const noQueryText = noQueryVisible ? (await search.noQueryMessage.textContent())?.trim() ?? '' : '';
  const results = await search.grid.locator('h3').allTextContents();

  let state: ResultsAreaState;
  if (noQueryVisible) {
    state = 'no query was run';
  } else if (bannerVisible && /no results found/i.test(bannerText)) {
    state = 'query executed, no matching products';
  } else if (bannerVisible) {
    state = 'query executed, products returned';
  } else {
    state = 'neither';
  }

  await testInfo.attach(`${label} — results area (verbatim)`, {
    body:
      `#keyword banner: ${bannerVisible ? `"${bannerText}"` : '(not present)'}\n` +
      `no-query-run message: ${noQueryVisible ? `"${noQueryText}"` : '(not present)'}\n` +
      `results list displayed: ${results.length > 0 ? `yes (${results.length} products)` : 'no'}\n` +
      (results.length > 0 ? `products:\n${results.join('\n')}\n` : '') +
      `SPR-10 state: ${state}\n`,
    contentType: 'text/plain',
  });
  await testInfo.attach(`${label} — results area screenshot`, {
    body: await page.locator('#page-content').screenshot(),
    contentType: 'image/png',
  });

  return state;
}

/**
 * TP-03-003 — Verify an empty or whitespace-only query does not run a
 * catalogue query. Covers TC-03-004 (#1 to #3). Renumbered from the old
 * TP-03-004 per the refined TPS FN-03 — content unchanged.
 *
 * The objective states an unambiguous expected outcome (no query runs),
 * so both submissions hard-assert the no-query-run placeholder state
 * rather than treating the result as ambiguous evidence.
 *
 * Both submissions record the results area the same way TP-03-002 does —
 * message text verbatim, a screenshot of the area, and which of the three
 * confirmed /search states was displayed (SPR-10). Previously the empty
 * submission recorded a fragile xpath sibling lookup with no screenshot,
 * and the whitespace-only submission recorded nothing but its URL, so a
 * reader could not see WHAT the store showed in either case — only that
 * the assertions had passed. The TPS wording for this procedure needs
 * updating to match; see the note handed over with this change.
 */
test.describe('FN-03 Product Search', () => {
  test('TP-03-003 empty and whitespace-only submission', async ({ page }, testInfo) => {
    const header = new HeaderBar(page);
    const search = new SearchResultsPage(page);

    await test.step('Set Up — open the store home page', async () => {
      await header.gotoHome();
    });

    await test.step('TC-03-004 #1 / #3 — empty submission via search icon', async () => {
      await header.searchByIcon('');
      const url = await recordUrl(page, testInfo, 'Empty submission');
      const state = await recordResultsArea(page, testInfo, search, 'Empty submission');
      await testInfo.attach('Empty submission — system response', {
        body: `destination: ${url}\ncontrol used: search icon\nSPR-10 state: ${state}`,
        contentType: 'text/plain',
      });

      await expect(search.noQueryMessage).toBeVisible();
      await expect(search.keywordBanner).not.toBeVisible();
      await expect(search.grid).toHaveCount(0);
    });

    await test.step('TC-03-004 #2 / #3 — whitespace-only submission via search icon', async () => {
      await header.gotoHome();
      await header.searchByIcon(SEARCH_TERMS.whitespaceOnly);
      const url = await recordUrl(page, testInfo, 'Whitespace-only submission');
      const state = await recordResultsArea(page, testInfo, search, 'Whitespace-only submission');
      await testInfo.attach('Whitespace-only submission — system response', {
        body:
          `destination: ${url}\ncontrol used: search icon\n` +
          `value submitted: TD-03-F (a single space, sent literally)\n` +
          `SPR-10 state: ${state}`,
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
