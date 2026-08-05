# SDSS Automated Test Suite — TDC 2.0

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
live store. Workers are capped at 2 and the CI matrix runs one browser on
push, all browsers only on the nightly schedule. Do not raise these.
