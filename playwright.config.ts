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
    testIgnore: process.env.INFRA ? [] : "**/_infra/**",

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
    timeout: 30_000,
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

        trace: "retain-on-failure",
        screenshot: "only-on-failure",
        video: "retain-on-failure",

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
        navigationTimeout: 20_000,
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
