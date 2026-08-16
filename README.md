# CHAMP CHAMP

## SDSS Automated Test Suite — TDC 2.0

Automated execution of the SDSS test procedures (SDSS_TPS_1_1.0.0) against
the Sauce Demo Shopify Store, using Playwright + TypeScript.

## Layout

    tests/              one spec per test procedure, foldered by feature (FN)
    pages/              page objects — all selectors live here
    fixtures/           test data carried from the TCS Test Data column
    utils/              SPR-01 / SPR-04 evidence helpers
    ci/                 the expected-result baseline — one entry per procedure
    scripts/            the CI comparator and the auth-session tooling
    docs/               setup and run guides
    .github/workflows/  the CI pipeline and the manual test-run dispatch

The TCS, TPS, TDS and Test Log are Word documents and are not versioned
here — they live in the team drive.

## Naming

Spec files mirror the TPS: `tp-01-001-global-navigation.spec.ts` runs
TP-01-001, which covers TC-01-001. Each `test.step` is tagged with the
TCS check number it verifies, so a failure in the report points straight
at a row in the Test Case Specification.

## Running

    npm ci
    npx playwright install
    npm test                  # all projects
    npm run test:chromium     # single browser
    npm run report            # open the HTML report

## Continuous integration

The system under test is a live, third-party production store. That governs
the whole pipeline: nothing runs on a schedule, and no unattended run ever
places an order.

`.github/workflows/ci.yml` runs three jobs.

- **Quality gate** — every push. Typechecks, compiles and discovers every
  spec, and runs three guards (no `test.fail()` reintroduced, FN-05 still
  excluded from CI, no merge conflict markers). Sends zero requests to the
  store.
- **Smoke** — pull requests and merges to main. Three read-only procedures,
  one per functional area, chosen to cover all three result shapes:
  TP-01-003 passes, TP-02-002 is blocked under A-013, TP-03-004 fails on
  DEF-F3-01. No cart, no checkout, no order.
- **Publish** — main only. Deploys the smoke report to GitHub Pages.

### Red and green come from the baseline, not the exit code

`test.fail()` was removed from the suite on 13 August: it reports an unmet
expected result as "passed", which contradicts the Defect Log. A confirmed
defect therefore fails like any other failure, and Playwright's exit code
alone can no longer tell you whether a run was good.

`ci/expected-results.json` records what each procedure is *expected* to do —
`pass`, `fail` against a named defect, or `blocked` against a named
assumption. `scripts/check-expected-results.mjs` compares the run against it
and decides the verdict. The build is red only where reality diverges from
the recorded findings, which means **an unexpected pass fails the build too**
— if a defect gets fixed without the Defect Log being updated, CI says so.

### Running a full functional area

CI deliberately never does this. Use the **Manual test run** workflow
(`workflow_dispatch`) to run a whole area with a chosen browser. FN-05 is
gated behind typing `CONFIRM`, because TP-05-004 completes a real order and
SPR-18 allows no more orders than the test cases require.

Only the smoke report is published to Pages. Evidence from manual FN-05/06/07
runs stays a download-only artefact — it carries account emails, reset links
and live checkout URLs, which SPR-24 keeps out of any published artefact.

## Traffic discipline

Constraint A-009 in the test basis records that live-production execution
constrains automated test volume, and requires automated execution to be
paced and run serially in small batches. Assumption A-005 separately
forbids bypassing or auto-solving the challenge when it does appear.
This site runs on Shopify behind Cloudflare, and Cloudflare
served a "Verify you are human" interstitial mid-run on 7 August — our
lecturer confirmed this is the site's own bot-protection reacting to
automated request patterns, not a defect in the tests, and that any team
automating against a real, live Cloudflare-protected site should expect
it after roughly 10-15 rapid runs.

Mitigations in place, none of them optional:

- `workers: 1` and `fullyParallel: false` — tests never run concurrently
  against the live site; parallel requests trip Cloudflare fastest.
- `launchOptions.slowMo` in `playwright.config.ts` paces every action
  (click, fill, navigation) to roughly human speed by default, not
  machine-instant. Override for a specific run with `SLOWMO=0` if you
  really need to, but that's opting back into the thing that caused this.
- `utils/pacedTest.ts` adds a few seconds' pause between test cases —
  every spec file imports `test`/`expect` from there instead of directly
  from `@playwright/test` so this applies uniformly (`tests/_infra` is
  the one deliberate exception, since it's already excluded from normal
  runs).
- No automatic retries (`retries: 0`) — a retry right after a possible
  Cloudflare-triggered failure is just more traffic for no benefit.

On top of that, run test files in small batches by hand (a handful at a
time), pause a few minutes, then continue — this is how every batch has
actually been run. If a run does hit the interstitial anyway, check the
trace for "Your connection needs to be verified" before treating the
result as a real failure.

The real-world lesson: proper maintenance testing against a target like
this would run against a staging environment rather than live
production, specifically to avoid tripping the live site's bot
protection in the first place.

## Secrets and environment

Copy `.env.example` to `.env` and fill in real values (gitignored, never
commit it). Eight variables: the shopper account (`TEST_ACCOUNT_*`), IMAP
access to its inbox (`IMAP_*`) for confirmation and reset email checks, and
the ENV-14 fresh account used by TP-06-006 (`FRESH_ACCOUNT_*`). See
`fixtures/credentials.ts` and `utils/email.ts`. In CI, the same names are
set as GitHub Actions Secrets instead.

## Signed-in tests (auth setup)

The login and register forms are hCaptcha-protected, and it challenges
every automated attempt regardless of how the interaction is paced —
confirmed there's no way to script past it. Any test that needs to
already be signed in uses a saved session instead of logging in through
the form:

    npm run auth:setup

This opens a real (non-headless, visible) browser at the login page. Log
in yourself, solving the captcha by hand — a human still has to click
through it once. When you close the browser window, Playwright saves the
session to `playwright/.auth/user.json` (gitignored — this is a live
session token, not something to share via git; every teammate running
these tests needs to do this themselves, and redo it once the session
expires).

A spec that needs to start already signed in loads that file directly:

```ts
test.use({ storageState: 'playwright/.auth/user.json' });
```

Tests that don't set this stay signed out by default (ENV-01).

Sessions expire, and several specs sign out as part of the test itself,
which kills the saved session server-side. `docs/auth-setup-guide.md` covers
recapture; `docs/fn06-run-instructions.md` covers the per-spec prerequisites
for FN-06.
