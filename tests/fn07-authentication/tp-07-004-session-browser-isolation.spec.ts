import { test, expect } from '../../utils/pacedTest';
import { recordUrl } from '../../utils/evidence';
import { startSignedInContext, startGuestContext } from './_helpers';

/**
 * TP-07-004 — Verify a session established in one browser does not sign the
 * shopper in on a different browser. Covers TC-07-015 (#1 to #3).
 *
 * SIGN-IN SUBSTITUTION: Browser A's signed-in starting state comes from the
 * transplanted session at playwright/.auth/user.json, not from driving the
 * login form. The form is hCaptcha-protected and rejects any browser
 * Playwright drives — confirmed against bundled Chromium and against real
 * Chrome, in both cases with a human solving the puzzle correctly (see
 * auth-setup-guide.md, tests/_infra/auth-session.spec.ts).
 *
 * Unlike the rest of FN-07, that substitution is sound here rather than a
 * compromise. TC-07-015 tests whether an established session is CONFINED to
 * the browser it was established in; how it came to exist is not the
 * behaviour under test, and the TPS itself declares the sign-in step's
 * coverage to TC-07-007 (TP-07-002) as an intercase dependency rather than
 * covering it here. Every other FN-07 procedure tests the login or
 * registration form directly and cannot be automated this way — see the
 * deferral note at the end of this comment.
 *
 * ENV-18 requires a second browser whose storage and cookies are independent
 * of the first. Two Playwright contexts give that by construction: separate
 * cookie jars, separate storage, no shared state. Browser B is created as a
 * genuine guest (no storageState) rather than by clearing Browser A, which
 * SPR-25 forbids between the two observations in any case.
 *
 * SPR-25 is satisfied throughout: nothing clears cookies or storage between
 * #1 and #3, since doing so would remove the session under test. The TPS
 * note is explicit that #3 exists to show a signed-out Browser B is
 * isolation rather than the session having ended altogether.
 *
 * No account is created and no password is changed by this procedure. No
 * defect contradicts it, so every check is hard-asserted — no test.fail().
 *
 * WRAP UP SIDE EFFECT: the sign-out at the end is a real action and
 * invalidates the transplanted session SERVER-SIDE, so
 * playwright/.auth/user.json must be re-captured before any other
 * signed-in test runs. Verified behaviour, not a precaution — see
 * tests/_infra/auth-session.spec.ts.
 *
 * DEFERRED, NOT MISSING: TP-07-001, 002, 003, 005 and 006 are not built.
 * Each carries a login or registration form submission as a numbered step,
 * which is the hCaptcha-blocked path. TP-07-005 and TP-07-006 additionally
 * change the real password of TD-07-ACC — the same account every other FN
 * branch's session capture depends on — so they need an explicit decision
 * before anyone runs them.
 */
test.describe('FN-07 Authentication', () => {
  test('TP-07-004 session browser isolation', async ({ browser }, testInfo) => {
    const browserA = await startSignedInContext(browser);
    const browserB = await startGuestContext(browser);

    try {
      await test.step('TC-07-015 #1 — Browser A holds a signed-in session', async () => {
        await browserA.page.goto('/account', { waitUntil: 'domcontentloaded' });
        const url = await recordUrl(browserA.page, testInfo, 'Browser A — account page');

        await expect(browserA.header.logOutLink).toBeVisible();
        const signedIn = await browserA.header.logOutLink.isVisible();

        await testInfo.attach('Browser A — signed-in state', {
          body:
            `destination: ${url}\n` +
            `log out control visible: ${signedIn}\n` +
            `log in control visible: ${await browserA.header.logInLink.isVisible()}\n` +
            'NOTE: this session was transplanted from a browser a human signed in ' +
            'manually (playwright/.auth/user.json); the sign-in action itself is ' +
            'covered by TC-07-007, declared as this case\'s intercase dependency.',
          contentType: 'text/plain',
        });

        expect(url).not.toContain('/account/login');
      });

      await test.step('TC-07-015 #2 — Browser B, with independent storage, is signed out', async () => {
        await browserB.page.goto('/', { waitUntil: 'domcontentloaded' });
        const url = await recordUrl(browserB.page, testInfo, 'Browser B — store home');

        // The header is the store's own signed-in indicator: the log-in
        // link is replaced by a log-out link once a session exists.
        await expect(browserB.header.logInLink).toBeVisible();
        await expect(browserB.header.logOutLink).toHaveCount(0);

        await testInfo.attach('Browser B — header state', {
          body:
            `destination: ${url}\n` +
            `log in control visible: ${await browserB.header.logInLink.isVisible()}\n` +
            `log out controls present: ${await browserB.header.logOutLink.count()}\n` +
            'Browser B was created as an independent context (ENV-18): its own ' +
            'cookie jar and storage, never a cleared copy of Browser A.',
          contentType: 'text/plain',
        });
      });

      await test.step('TC-07-015 #3 — Browser A is still signed in after the Browser B check', async () => {
        await browserA.page.goto('/account', { waitUntil: 'domcontentloaded' });
        const url = await recordUrl(browserA.page, testInfo, 'Browser A — after Browser B check');

        await expect(browserA.header.logOutLink).toBeVisible();

        await testInfo.attach('Browser A — state after the check', {
          body:
            `destination: ${url}\n` +
            `log out control visible: ${await browserA.header.logOutLink.isVisible()}\n` +
            'Confirms the signed-out result in Browser B is isolation, not the ' +
            'session having ended altogether (TPS note to Table 2.7.4).',
          contentType: 'text/plain',
        });

        expect(url).not.toContain('/account/login');
      });

      await test.step('Wrap Up — sign out on Browser A, close Browser B, both back to the store', async () => {
        await browserA.header.logOutLink.click();
        await browserA.page.waitForURL(
          (u) => !u.pathname.startsWith('/account') || u.pathname === '/account/login',
        );
        await recordUrl(browserA.page, testInfo, 'Browser A — after sign out');

        await browserA.header.gotoHome();
        await browserB.header.gotoHome();
      });
    } finally {
      await browserA.context.close();
      await browserB.context.close();
    }
  });
});
