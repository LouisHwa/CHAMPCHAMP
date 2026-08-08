# CHAMP CHAMP

## SDSS Automated Test Suite — TDC 2.0

Automated execution of the SDSS test procedures (SDSS_TPS_1_1.0.0) against
the Sauce Demo Shopify Store, using Playwright + TypeScript.

## Layout

    tests/        one spec per test procedure, foldered by feature (FN)
    pages/        page objects — all selectors live here
    fixtures/     test data carried from the TCS Test Data column
    utils/        SPR-01 / SPR-04 evidence helpers
    docs/         TCS, TPS and TDS source documents

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

## Traffic discipline

Assumption A-005 in the test basis forbids abnormal traffic against the
live store. This site runs on Shopify behind Cloudflare, and Cloudflare
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
  FN-05 specs import `test`/`expect` from there instead of directly from
  `@playwright/test` so this applies uniformly across them (`tests/_infra`
  is a deliberate exception, since it's already excluded from normal
  runs). FN-01–03 on this branch still import `@playwright/test`
  directly; they're identical files to `fn04-cart-management`'s copies,
  which already have this applied, so the eventual merge brings them in
  sync rather than needing it done twice.
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
