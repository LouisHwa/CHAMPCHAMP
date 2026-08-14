import "dotenv/config";
import { defineConfig, devices } from "@playwright/test";

/**
 * SDSS automated suite — MSTB TDC 2.0, Young & Broke
 * Test basis: SDSS_TCS_1_1.0.0 / SDSS_TPS_1_1.0.0
 *
 * Evidence settings below implement the Special Procedural Requirements:
 *   SPR-01  destination URL recorded at every navigation  -> trace
 *   SPR-04  screenshot + URL captured on any failed step  -> screenshot + trace
 *
 * "dotenv/config" loads .env (gitignored) for the TEST_ACCOUNT and IMAP
 * variables — see .env.example. In CI these come from GitHub Actions
 * Secrets instead; dotenv silently no-ops if .env doesn't exist, so
 * this is safe either way.
 */
// run this first 'npm install --save-dev allure-playwright'

const isCI = !!process.env.CI;

export default defineConfig({
    testDir: "./tests",

    // tests/_infra holds checks on the harness itself (e.g. whether the
    // transplanted signed-in session still works). They discharge no TCS
    // coverage item, so they must never appear in a compliance run or its
    // report. testIgnore applies even when a file is named explicitly on the
    // command line, so it is env-gated rather than absolute:
    //   PowerShell   $env:INFRA=1; npx playwright test tests/_infra/...
    //   bash         INFRA=1 npx playwright test tests/_infra/...
    testIgnore: [
        ...(process.env.INFRA ? [] : ["**/_infra/**"]),

        // FN-05 completes four REAL orders on the live storefront (one in
        // TP-05-004, two in TP-05-005, one in TP-05-006). Both CI workflows
        // run the suite on every push and pull request to main, and one runs
        // nightly on a schedule — unattended, that would place four orders
        // per run indefinitely. SPR-18 allows no more orders than the test
        // cases require, and A-005 forbids actions that modify the system,
        // so these procedures are executed manually and never by CI.
        ...(isCI ? ["**/fn05-checkout/**"] : []),
    ],

    // A-005: no abnormal traffic against the production storefront.
    // Running in parallel is what actually trips Cloudflare fastest
    // (confirmed 7 August), so this is 1 everywhere, CI included — never
    // raise it for "speed".
    workers: 1,
    fullyParallel: false,

    forbidOnly: isCI,
    // A retry immediately re-hits the live site right after a failure
    // that may itself have been Cloudflare — no benefit, just more
    // traffic. Re-run manually (paced) instead.
    retries: 0,
    // 30s was the default before pacing was introduced, and it collides
    // with slowMo: 600 — every action now carries an extra 0.6s, so a
    // procedure with ~50 actions spends 30s on pacing alone. TP-04-003
    // timed out at exactly 30s for this reason on 8 August, which
    // test.fail() then reported as an expected failure. TP-05-001 hit
    // the same wall live on this branch (9 Aug) before this was applied
    // here — fn05-checkout never received wenPen20's fix to this value.
    timeout: 90_000,
    expect: { timeout: 7_000 },

    reporter: [
        ["list"],
        ["html", { outputFolder: "playwright-report", open: "never" }],
        ["junit", { outputFile: "test-results/junit.xml" }],
        ["allure-playwright", { outputFolder: "allure-results" }],
    ],

    use: {
        baseURL: "https://sauce-demo.myshopify.com",

        // ENV-01: clean state, no shopper signed in.
        // Playwright gives each test a fresh browser context by default,
        // so cache/cookies start empty for every test.
        storageState: undefined,

        // Unconditionally "on" for FN-05, not env-gated the way main has
        // it. Every other suite can be re-run cheaply if a run turns out
        // to have recorded nothing; these procedures place four REAL
        // orders on the live storefront and are the most exposed to
        // Cloudflare pacing limits (A-009), so a run that produces no
        // evidence cannot simply be repeated. A passing procedure needs
        // its trace and video as much as a failing one — a pass with no
        // evidence cannot be shown to have been executed.
        trace: "on",
        screenshot: "on",
        video: "on",

        // Cloudflare served an interstitial during a signed-out FN-04 batch
        // on 7 August — automating a live, Cloudflare-protected site at
        // machine speed reads as bot traffic. Pacing every action to
        // roughly how a human actually clicks/types (not machine-instant)
        // is the lecturer-confirmed mitigation, so this is on by default
        // rather than opt-in. Override for a specific run if needed:
        //   PowerShell   $env:SLOWMO=0; npx playwright test ...
        //   bash         SLOWMO=0 npx playwright test ...
        launchOptions: { slowMo: Number(process.env.SLOWMO ?? 600) },

        actionTimeout: 10_000,
        // 20s was not enough: TP-04-004 died in Set Up on 10 August when
        // page.goto('/cart') exceeded it, while the captured page text shows
        // the storefront had rendered normally — so the content arrived and
        // only the navigation event was late. This store is third-party
        // heavy (the reason every page object navigates with
        // 'domcontentloaded' rather than 'load' — see HeaderBar.gotoHome),
        // and a slow local uplink produces the same signature. 45s absorbs
        // both without masking a genuine hang, since the per-test budget
        // still cuts in at 90s. Ported from main; fn05-checkout was worked
        // independently and never received it.
        navigationTimeout: 45_000,
    },

    // TCS 2.1.1: latest stable Chrome, Firefox or Edge.
    projects: [
        { name: "chromium", use: { ...devices["Desktop Chrome"] } },
        { name: "firefox", use: { ...devices["Desktop Firefox"] } },
        // Edge needs: npx playwright install msedge
        {
            name: "edge",
            use: { ...devices["Desktop Edge"], channel: "msedge" },
        },
    ],

    outputDir: "test-results",
});
