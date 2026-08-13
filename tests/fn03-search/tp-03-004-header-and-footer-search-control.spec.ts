import type { Page, TestInfo } from '@playwright/test';
import { test, expect } from '../../utils/pacedTest';
import { HeaderBar } from '../../pages/HeaderBar';
import { Footer } from '../../pages/Footer';
import { SearchResultsPage } from '../../pages/SearchResultsPage';
import { SEARCH_TERMS } from '../../fixtures/test-data';
import { recordUrl } from '../../utils/evidence';

/**
 * Records one control's outcome for TPS Steps 5 and 7: whether a catalogue
 * query executed at all or the placeholder state was displayed instead,
 * the full result set, how it compares with the reference set, and a
 * screenshot of the results area (SPR-10).
 *
 * The TPS asks for the screenshot "where the step does not produce its
 * expected result". It is captured unconditionally here for two reasons.
 * Under DEF-F3-01 neither step produces its expected result, so the
 * condition always holds anyway. And the automatic only-on-failure
 * screenshot cannot serve as a substitute: these are soft assertions, so
 * Playwright takes its screenshot during teardown — after the Wrap Up has
 * navigated back to the home page — and would capture the home page
 * rather than the results area. The 'expected result produced' line
 * records the TPS condition explicitly either way.
 */
async function recordControlOutcome(
  page: Page,
  testInfo: TestInfo,
  search: SearchResultsPage,
  label: string,
  url: string,
  referenceResults: string[],
) {
  const [queryExecuted, noQueryVisible] = await Promise.all([
    search.keywordBanner.isVisible(),
    search.noQueryMessage.isVisible(),
  ]);
  const bannerText = queryExecuted ? (await search.keywordBanner.textContent())?.trim() ?? '' : '';
  const results = await search.grid.locator('h3').allTextContents();
  const matchesReference =
    [...results].sort().join('|') === [...referenceResults].sort().join('|');

  await testInfo.attach(`${label} — outcome`, {
    body:
      `destination: ${url}\n` +
      `control used: ${label}\n` +
      `catalogue query executed: ${queryExecuted}\n` +
      `#keyword banner: ${queryExecuted ? `"${bannerText}"` : '(not present)'}\n` +
      `no-query-run placeholder shown: ${noQueryVisible}\n` +
      `products returned: ${results.length}\n` +
      (results.length > 0 ? `results:\n${results.join('\n')}\n` : '') +
      `matches reference result set: ${matchesReference}\n` +
      `expected result produced: ${queryExecuted && matchesReference ? 'yes' : 'no'}\n`,
    contentType: 'text/plain',
  });
  await testInfo.attach(`${label} — results area screenshot`, {
    body: await page.locator('#page-content').screenshot(),
    contentType: 'image/png',
  });

  return { queryExecuted, results };
}

/**
 * TP-03-004 — Verify the header and footer Search controls each execute
 * a real search using the field contents. Covers TC-03-005 (#1) and
 * TC-03-006 (#1) — merged per the refined TPS FN-03, replacing the old
 * separate TP-03-005/TP-03-006.
 *
 * Intercase dependency: TP-03-001 must have run (search icon returns
 * matching products for a valid term).
 *
 * The refined document establishes the reference result set ONCE and
 * reuses it for both comparisons — "TC-03-001 confirms only that the
 * search icon executes a real query and does not submit this term, so
 * the reference set cannot be inherited from it" — unlike the old two
 * separate files, which each established their own identical reference
 * set.
 *
 * EXPECTED TO FAIL on BOTH sections — DEF-F3-01. The header and footer
 * "Search" links are each a plain <a href="/search"> sitting outside the
 * #product-search form, so filling the field and clicking either does not
 * carry the value through: both land on the "no search performed"
 * placeholder instead of running a query. That contradicts the
 * objective's unambiguous expected outcome for both test cases, and the
 * TPS names Steps 4 and 6 as the points at which DEF-F3-01 becomes
 * observable.
 *
 * The failure IS the finding, so this reports FAILED rather than being
 * marked test.fail(). Per the TDS methodology — "a coverage item that
 * exposes a known defect is recorded as a failure, not silently passed" —
 * test.fail() would make Playwright print "passed" for a procedure whose
 * assertions failed, misstating the result in a verification report, and
 * would also suppress the screenshot/trace/video that retain-on-failure
 * keeps. DEF-F3-01 is named in the annotation below so a reader can tell
 * this apart from a regression.
 *
 * Both sections use expect.soft. Previously they hard-asserted, which
 * threw inside TC-03-005's step and aborted the whole test — so TC-03-006
 * never executed and the footer control was never actually exercised,
 * despite the TPS requiring both TC-03-005 #1 and TC-03-006 #1 to be
 * discharged with their own evidence. Soft assertions let both sections
 * run and attach their outcome; the test still reports FAILED.
 */
test.describe('FN-03 Product Search', () => {
  test('TP-03-004 header and footer Search control', async ({ page }, testInfo) => {
    testInfo.annotations.push({
      type: 'known defect',
      description:
        'DEF-F3-01 — the header and footer "Search" controls do not carry the search field value, ' +
        'so neither runs a catalogue query; both land on the no-query-run placeholder. Both ' +
        'sections are expected to FAIL against the current store; the failures are the recorded ' +
        'findings, not a broken test. If they start passing, the controls have been fixed.',
    });

    const header = new HeaderBar(page);
    const footer = new Footer(page);
    const search = new SearchResultsPage(page);

    let referenceResults: string[] = [];

    await test.step('Set Up — reference result set via search icon (shared by both comparisons)', async () => {
      await header.gotoHome();
      await header.searchByIcon(SEARCH_TERMS.headerFooterControlCheck);
      // The Wrap Up requires all THREE destination URLs, the reference
      // search's included — it was the one that went unrecorded.
      const url = await recordUrl(page, testInfo, 'Reference result set (search icon)');
      referenceResults = await search.grid.locator('h3').allTextContents();
      await testInfo.attach('Reference result set (search icon, "sandals")', {
        body:
          `destination: ${url}\ncontrol used: search icon\n` +
          `products returned: ${referenceResults.length}\n` +
          `results:\n${referenceResults.join('\n')}`,
        contentType: 'text/plain',
      });
      expect(referenceResults.length).toBeGreaterThan(0);
    });

    await test.step('TC-03-005 #1 — same term via the header Search control', async () => {
      await header.gotoHome();
      await header.searchField.fill(SEARCH_TERMS.headerFooterControlCheck);
      await header.searchLink.click();
      const url = await recordUrl(page, testInfo, 'Header Search control');
      const { queryExecuted, results } = await recordControlOutcome(
        page,
        testInfo,
        search,
        'Header Search control',
        url,
        referenceResults,
      );

      // Expected to fail — DEF-F3-01. Soft, so TC-03-006 below still runs
      // and the footer control is actually exercised.
      expect
        .soft(queryExecuted, 'TC-03-005 #1 expects the header Search control to run a real catalogue query, not the no-query-run placeholder (DEF-F3-01).')
        .toBe(true);
      expect
        .soft(results.sort(), 'TC-03-005 #1 expects the header control to return the same products as the search icon reference set (DEF-F3-01).')
        .toEqual([...referenceResults].sort());
    });

    await test.step('TC-03-006 #1 — same term via the footer Search control', async () => {
      await header.gotoHome();
      await header.searchField.fill(SEARCH_TERMS.headerFooterControlCheck);
      await footer.searchLink.scrollIntoViewIfNeeded();
      await footer.searchLink.click();
      const url = await recordUrl(page, testInfo, 'Footer Search control');
      const { queryExecuted, results } = await recordControlOutcome(
        page,
        testInfo,
        search,
        'Footer Search control',
        url,
        referenceResults,
      );

      // Expected to fail — DEF-F3-01. Soft, so the Wrap Up still runs and
      // both sections' evidence is present in the report.
      expect
        .soft(queryExecuted, 'TC-03-006 #1 expects the footer Search control to run a real catalogue query, not the no-query-run placeholder (DEF-F3-01).')
        .toBe(true);
      expect
        .soft(results.sort(), 'TC-03-006 #1 expects the footer control to return the same products as the search icon reference set (DEF-F3-01).')
        .toEqual([...referenceResults].sort());
    });

    await test.step('Wrap Up — return to the store home page', async () => {
      await header.gotoHome();
    });
  });
});
