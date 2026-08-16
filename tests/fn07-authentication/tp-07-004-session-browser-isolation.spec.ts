import { test, expect } from '../../utils/pacedTest';
import { withFailureEvidence, recordUrl } from '../../utils/evidence';
import { startSignedInContext, startGuestContext } from './_helpers';

/**
 * TP-07-004 — Verify a session established in one browser does not sign the
 * shopper in on a different browser. Covers TC-07-015 (#1 to #3).
 *
 * THE ONLY FULLY AUTOMATED PROCEDURE IN FN-07, and it is worth recording why,
 * because every other procedure in this section is executed manually.
 *
 * The store's login and registration forms are protected by an hCaptcha that
 * a Playwright-driven browser cannot clear. Confirmed 12 August against
 * bundled Chromium: the challenge injects itself on submit, reissues
 * indefinitely, never returns a token, and the submission never leaves the
 * browser — no request reaches the store at all, which is why such an attempt
 * produces no error message. A human working the challenge correctly for ten
 * continuous minutes did not clear it either. Evidence is in the run reports
 * for that date.
 *
 * TC-07-015 is unaffected by that, because NONE of its checks submits a form:
 *
 *   #1  browser A holds a signed-in session   — read the header
 *   #2  browser B is signed out               — read the header
 *   #3  browser A is still signed in          — read the header
 *
 * The sign-in that puts browser A into its starting state is not one of those
 * checks. TC-07-015 declares TC-07-007 ("matching credentials establish a
 * signed-in session") as its intercase dependency for exactly that reason —
 * the sign-in is discharged there, and here it is only how browser A arrives.
 * So the state is supplied by the session transplanted into
 * playwright/.auth/user.json, captured by a human signing in through a normal
 * browser. This is a starting condition, not a skipped step.
 *
 * ENV-19 requires a second browser whose storage and cookies are independent
 * of the first. Two Playwright contexts give that by construction: separate
 * cookie jars, separate storage, nothing shared. Browser B is created as a
 * genuine guest rather than by clearing browser A, which SPR-25 forbids
 * between the two observations in any case.
 *
 * SPR-25 is satisfied throughout: nothing clears cookies or storage between
 * #1 and #3, since doing so would remove the session under test. The TPS note
 * to Table 2.7.4 is explicit that #3 exists to show a signed-out browser B is
 * isolation rather than the session having ended altogether.
 *
 * No account is created and no password is changed. No Defect Log entry
 * contradicts this procedure — DEF-F7-01 belongs to TC-07-017, in TP-07-006 —
 * so every check is hard-asserted.
 *
 * WRAP UP SIDE EFFECT: the sign-out at the end is a real action and
 * invalidates the transplanted session SERVER-SIDE, so
 * playwright/.auth/user.json must be re-captured before any other signed-in
 * work runs. Verified behaviour, not a precaution.
 *
 * PRE-RUN CHECK: npm run auth:verify. If it reports SIGNED OUT, recapture
 * before running this, or #1 fails on a stale session rather than testing
 * anything.
 */
test.describe('FN-07 Authentication', () => {
  test('TP-07-004 session browser isolation', async ({ browser }, testInfo) => {
    test.setTimeout(120_000);

    const browserA = await startSignedInContext(browser);
    const browserB = await startGuestContext(browser);

    try {
      await withFailureEvidence(browserA.page, testInfo, 'TP-07-004 unexpected failure', async () => {
        await test.step('Set Up #1 — Browser B starts clean; Browser A carries the transplanted session (ENV-19)', async () => {
          await browserB.header.gotoHome();
          const guestUrl = await recordUrl(browserB.page, testInfo, 'Browser B — start state');

          await testInfo.attach('Set Up step 1 — declared preconditions and one deviation (ENV-19)', {
            body:
              `Browser B destination: ${guestUrl}\n` +
              `Browser B signed in at start: ${(await browserB.header.logOutLink.count()) > 0}\n` +
              `Browser A signed in at start: true (by construction — see below)\n\n` +
              'ENV-19 IS SATISFIED. Browser A is a Playwright context; Browser B is a\n' +
              'separate context created with no stored state at all. The two share no\n' +
              'cookie jar and no storage, which is what ENV-19 requires. Both are freshly\n' +
              'created rather than cleared, which is a stronger guarantee than clearing.\n\n' +
              'DEVIATION FROM SET UP STEP 1. The step asks that BOTH browsers start with\n' +
              'no shopper account signed in. That holds for Browser B and is asserted\n' +
              'above. It does NOT hold for Browser A: this procedure cannot sign in\n' +
              'through the storefront (see the file header — hCaptcha blocks every\n' +
              'submission from a Playwright-driven browser), so Browser A is created with\n' +
              "the session already loaded from playwright/.auth/user.json. Browser A's\n" +
              'signed-out start state is therefore NOT verified here.\n\n' +
              'This does not weaken TC-07-015. Its three checks are about whether a\n' +
              'session is confined to one browser, and Browser B — the browser the\n' +
              'isolation claim is actually tested against — is verified clean above.\n\n' +
              'DECLARED, NOT ASSERTED: that the credentials for TD-07-ACC are available.\n' +
              'That is a property of the environment, not something the storefront can be\n' +
              'asked about.',
            contentType: 'text/plain',
          });

          expect(await browserB.header.logOutLink.count()).toBe(0);
        });

        await test.step('Set Up #2 — TP-07-002 executed; matching credentials establish a signed-in session', async () => {
          await testInfo.attach('Set Up step 2 — intercase dependency (TC-07-015: TC-07-007)', {
            body:
              'TC-07-015 declares TC-07-007 as its intercase dependency: that matching\n' +
              'credentials establish a signed-in session. TC-07-007 is discharged by\n' +
              'TP-07-002, executed manually, and its result is recorded in that\n' +
              "procedure's test log.\n\n" +
              'This procedure therefore takes a signed-in session as its starting state\n' +
              'rather than performing the sign-in itself, which is what the dependency\n' +
              'declaration means.',
            contentType: 'text/plain',
          });
        });

        await test.step('TC-07-015 #1 — a signed-in session is established in Browser A (SPR-25)', async () => {
          await browserA.page.goto('/account', { waitUntil: 'domcontentloaded' });
          const url = await recordUrl(browserA.page, testInfo, 'Browser A — account page');

          await expect(browserA.header.logOutLink).toBeVisible();

          await testInfo.attach('Browser A — signed-in state', {
            body:
              `destination: ${url}\n` +
              `log out control visible: ${await browserA.header.logOutLink.isVisible()}\n` +
              `log in control present:  ${await browserA.header.logInLink.count()}\n\n` +
              'The header is the store\'s own signed-in indicator: the log-in link is\n' +
              'replaced by a log-out link once a session exists. Reaching /account without\n' +
              'being redirected to /account/login is the second, independent signal.\n\n' +
              'HOW THIS SESSION WAS ESTABLISHED — read before citing this result.\n' +
              'Set Up step 3 asks that Browser A sign in with TD-07-ACC and its matching\n' +
              'password. THAT SIGN-IN WAS NOT PERFORMED HERE. The storefront rejects every\n' +
              'submission from a Playwright-driven browser (hCaptcha; see the file header),\n' +
              'so the session was established by a human signing in through an ordinary\n' +
              'browser, exported, and loaded into this context from\n' +
              'playwright/.auth/user.json.\n\n' +
              'What is verified above is the state the step is checking for — that a\n' +
              'signed-in session exists in Browser A — not the act of signing in. The act\n' +
              'itself belongs to TC-07-007, which TC-07-015 declares as its intercase\n' +
              'dependency and which TP-07-002 discharges manually.',
            contentType: 'text/plain',
          });

          expect(url).not.toContain('/account/login');
        });

        await test.step('TC-07-015 #2 — Browser B, with independent storage, is shown as signed out (SPR-25)', async () => {
          await browserB.page.goto('/', { waitUntil: 'domcontentloaded' });
          const url = await recordUrl(browserB.page, testInfo, 'Browser B — store home');

          await expect(browserB.header.logInLink).toBeVisible();
          await expect(browserB.header.logOutLink).toHaveCount(0);

          await testInfo.attach('Browser B — header state', {
            body:
              `destination: ${url}\n` +
              `log in control visible:  ${await browserB.header.logInLink.isVisible()}\n` +
              `log out controls present: ${await browserB.header.logOutLink.count()}\n\n` +
              'Browser B was created as an independent context (ENV-19): its own cookie\n' +
              'jar and storage, never a cleared copy of Browser A. Under SPR-25 nothing\n' +
              'has been cleared between this observation and the previous one.',
            contentType: 'text/plain',
          });
        });

        await test.step('TC-07-015 #3 — the shopper remains signed in in Browser A (SPR-25)', async () => {
          await browserA.page.goto('/account', { waitUntil: 'domcontentloaded' });
          const url = await recordUrl(browserA.page, testInfo, 'Browser A — after the Browser B check');

          await expect(browserA.header.logOutLink).toBeVisible();

          await testInfo.attach('Browser A — state after the check', {
            body:
              `destination: ${url}\n` +
              `log out control visible: ${await browserA.header.logOutLink.isVisible()}\n\n` +
              'Confirms the signed-out result in Browser B is isolation rather than the\n' +
              'session having ended altogether (TPS note to Table 2.7.4). Without this,\n' +
              "#2 would be satisfied equally by a session that had simply expired.",
            contentType: 'text/plain',
          });

          expect(url).not.toContain('/account/login');
        });

        await test.step('Wrap Up — sign out on Browser A, close Browser B, return both to the store home page', async () => {
          await browserA.header.logOutLink.click();
          await browserA.page.waitForURL(
            (u) => !u.pathname.startsWith('/account') || u.pathname === '/account/login',
          );
          const signedOutUrl = await recordUrl(browserA.page, testInfo, 'Browser A — after sign out');

          await browserA.header.gotoHome();
          await browserB.header.gotoHome();

          await testInfo.attach('Wrap Up — end state', {
            body:
              `Browser A destination after sign out: ${signedOutUrl}\n` +
              `Browser A signed in at end: ${(await browserA.header.logOutLink.count()) > 0}\n` +
              `Browser B signed in at end: ${(await browserB.header.logOutLink.count()) > 0}\n\n` +
              'The sign-out above is a real action and invalidates the transplanted\n' +
              'session SERVER-SIDE. playwright/.auth/user.json is dead from this point\n' +
              'and must be re-captured before any other signed-in work runs.',
            contentType: 'text/plain',
          });

          expect(await browserA.header.logOutLink.count()).toBe(0);
        });
      });
    } finally {
      // Read the paths BEFORE closing — the .webm is only written out on
      // close, but page.video() disappears with the context. Attaching after
      // close is what puts them in the HTML report; a video from a hand-made
      // context is not collected by the reporter on its own.
      const videoA = await browserA.page.video()?.path();
      const videoB = await browserB.page.video()?.path();

      await browserA.context.close();
      await browserB.context.close();

      if (videoA) {
        await testInfo.attach('Browser A — video', { path: videoA, contentType: 'video/webm' });
      }
      if (videoB) {
        await testInfo.attach('Browser B — video', { path: videoB, contentType: 'video/webm' });
      }
    }
  });
});
