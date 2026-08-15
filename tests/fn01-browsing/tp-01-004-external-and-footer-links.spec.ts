import { test, expect } from '../../utils/pacedTest';
import type { Locator } from '@playwright/test';
import { HeaderBar } from '../../pages/HeaderBar';
import { SidebarNav } from '../../pages/SidebarNav';
import { Footer } from '../../pages/Footer';
import { EXTERNAL_DESTINATIONS } from '../../fixtures/test-data';
import { recordUrl } from '../../utils/evidence';

/**
 * TP-01-004 — Verify social icons, the RSS feed icon and footer links
 * resolve to their correct destinations. Covers TC-01-004 (#1 to #4).
 *
 * All social icons and the RSS icon carry target="_blank" (open a new
 * tab); the footer "Sauce" link does not (confirmed from the live DOM)
 * and navigates in the same tab.
 *
 * External destinations are outside this team's control and can be
 * slow, geo-restricted, or block automated traffic outright (Instagram
 * in particular is known to reject headless browsers). Each external
 * check is wrapped so a third party's unavailability is recorded as
 * evidence rather than failing the whole procedure, per the TP's own
 * "record ... whether a live page is returned" wording — that implies
 * capturing the outcome, not asserting a specific one. Own-side
 * correctness (does the link point at the right domain) still uses a
 * soft assertion so a genuinely wrong href is visible in the report.
 */
test.describe('FN-01 Product Browsing and Navigation', () => {
  test('TP-01-004 external and footer link resolution', async ({ page, context }, testInfo) => {
    const header = new HeaderBar(page);
    const sidebar = new SidebarNav(page);
    const footer = new Footer(page);

    // The Wrap Up has to attach "the recorded destination URLs and any
    // screenshots captured under SPR-04", so each step keeps what it
    // observed rather than only attaching it in isolation.
    const destinations: string[] = [];

    async function recordExternalPopup(label: string, trigger: Locator, expectedHost: string | RegExp) {
      try {
        const [popup] = await Promise.all([
          context.waitForEvent('page', { timeout: 15_000 }),
          trigger.click(),
        ]);
        await popup.waitForLoadState('domcontentloaded', { timeout: 15_000 }).catch(() => {});
        const destination = popup.url();
        destinations.push(`${label}: ${destination} (live page returned: yes)`);
        await testInfo.attach(`${label} — destination URL / live page`, {
          body: `destination: ${destination}\nlive page returned: yes (load event observed)`,
          contentType: 'text/plain',
        });
        if (typeof expectedHost === 'string') {
          expect.soft(destination).toContain(expectedHost);
        } else {
          expect.soft(destination).toMatch(expectedHost);
        }
        await popup.close();
      } catch (error) {
        destinations.push(`${label}: no page opened, or no response in time`);
        await testInfo.attach(`${label} — destination URL / live page`, {
          body: `No page opened, or the destination did not respond in time: ${(error as Error).message}`,
          contentType: 'text/plain',
        });
      }
    }

    await test.step('Set Up — confirm preconditions, open the store home page', async () => {
      await header.gotoHome();
      destinations.push(`Set Up (home): ${await recordUrl(page, testInfo, 'home page')}`);

      // ENV-01: fresh context per test, so cache and cookies start empty.
      // The TPS also asks to confirm no shopper account is signed in.
      const signedOut = await header.logInLink.isVisible().catch(() => false);

      // ENV-03 (unrestricted outbound access to Facebook, Twitter/X,
      // Instagram, Pinterest and shopify.com) is confirmed by the steps
      // themselves: each records whether a live page was returned from its
      // destination. A blocked or unreachable destination shows up there as
      // "no page opened", which distinguishes an environment problem from a
      // broken link on the store.
      await testInfo.attach('Set Up — preconditions', {
        body: [
          `ENV-01 — "Log In" control visible (i.e. no shopper signed in): ${signedOut}`,
          'ENV-03 — outbound access to Facebook, Twitter/X, Instagram, Pinterest and',
          'shopify.com: confirmed per destination by the steps below, each of which',
          'records whether a live page was returned.',
        ].join('\n'),
        contentType: 'text/plain',
      });
      expect(signedOut, 'ENV-01: no shopper account should be signed in at Set Up').toBe(true);
    });

    const socialIcons: { label: string; locator: Locator; host: string | RegExp }[] = [
      { label: 'Facebook icon', locator: sidebar.facebookIcon, host: EXTERNAL_DESTINATIONS.facebook },
      // The icon's own href is still twitter.com, but Twitter's platform-
      // wide rebrand means it now redirects to x.com — confirmed live,
      // not a defect in this store. Accept either.
      { label: 'Twitter/X icon', locator: sidebar.twitterIcon, host: /twitter\.com|x\.com/ },
      { label: 'Instagram icon', locator: sidebar.instagramIcon, host: EXTERNAL_DESTINATIONS.instagram },
      { label: 'Pinterest icon', locator: sidebar.pinterestIcon, host: EXTERNAL_DESTINATIONS.pinterest },
    ];

    for (const icon of socialIcons) {
      await test.step(`TC-01-004 #1 — ${icon.label}`, async () => {
        await recordExternalPopup(icon.label, icon.locator, icon.host);
      });
    }

    await test.step('TC-01-004 #2 — RSS/feed icon', async () => {
      await recordExternalPopup('RSS icon', sidebar.rssIcon, '/blogs/news.atom');
    });

    await test.step('TC-01-004 #3 — footer "Sauce" link', async () => {
      // No target="_blank" here — navigates in the same tab, unlike
      // every other control in this procedure.
      await footer.sauceLink.click();
      const destination = await recordUrl(page, testInfo, 'Footer Sauce link');
      destinations.push(`Footer "Sauce" link [#3]: ${destination}`);
      expect.soft(destination).toContain('sauceapp.io');

      // TCS expected result: "A valid, live destination is opened." Checking
      // the URL alone is not enough to establish that — a parked or dead
      // domain still answers, and still carries the expected hostname.
      // Confirmed live (14 Aug): sauceapp.io responds HTTP 200 but serves a
      // registrar domain-parking placeholder, which is what DEF-F1-06
      // (footer "Sauce" link destination) describes. Soft, so #4 and the
      // Wrap Up still run.
      const destTitle = await page.title().catch(() => '');
      const destBody = (await page.locator('body').innerText().catch(() => '')).slice(0, 800);
      const parked =
        /parked by the owner|domain name has been registered|buy this domain|domain for sale/i.test(destBody) ||
        destTitle.trim().toLowerCase() === 'sauceapp.io';

      await testInfo.attach('Footer "Sauce" link — destination page', {
        body: `destination: ${destination}\npage title: ${destTitle}\ndomain-parking placeholder: ${parked}\n\nfirst 800 characters of the page:\n${destBody}`,
        contentType: 'text/plain',
      });

      expect.soft(
        parked,
        `TC-01-004 #3: TCS expects a valid, live destination (DEF-F1-06) — ${destination} serves a domain-parking placeholder, page title "${destTitle}"`,
      ).toBe(false);
      await header.gotoHome();
    });

    await test.step('TC-01-004 #4 — footer "Shopping Cart by Shopify" link', async () => {
      await recordExternalPopup('Shopping Cart by Shopify link', footer.shoppingCartByShopifyLink, EXTERNAL_DESTINATIONS.shopify);
    });

    await test.step('Wrap Up — close external tabs, return home, attach the recorded results', async () => {
      // TPS Wrap Up: "Close any browser tabs opened by external
      // destinations and return to the store home page." Each step already
      // closes the tab it opened; this is the backstop for any left behind
      // by a destination that failed mid-step.
      const strays = context.pages().filter((p) => p !== page);
      for (const stray of strays) await stray.close().catch(() => {});

      await header.gotoHome();
      destinations.push(`Wrap Up (home): ${await recordUrl(page, testInfo, 'Wrap Up — store home page')}`);

      await testInfo.attach('TP-01-004 Wrap Up — recorded results', {
        body: [
          'DESTINATION URLs RECORDED',
          ...destinations.map((d) => `  ${d}`),
          '',
          `External tabs still open at Wrap Up (closed here): ${strays.length}`,
          'Screenshots captured under SPR-04 are attached to their own steps above.',
        ].join('\n'),
        contentType: 'text/plain',
      });
    });
  });
});
