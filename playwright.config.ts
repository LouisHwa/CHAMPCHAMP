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

/**
 * SPR-04 only requires evidence where a step fails, so a passing run
 * records nothing by default — which is also what keeps artefact size
 * sane in CI. Set EVIDENCE=1 to capture trace, video and screenshots on a
 * green run as well, for reviewing how a procedure actually executed:
 *   PowerShell   $env:EVIDENCE=1; npx playwright test ... --project=chromium
 *   bash         EVIDENCE=1 npx playwright test ... --project=chromium
 * There is no --video CLI flag, so this is the only way to get playback
 * for a test that passes.
 */
const fullEvidence = !!process.env.EVIDENCE;

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
    // Keep concurrency low and never raise this for "speed".
    workers: isCI ? 2 : 2,
    fullyParallel: false,

    forbidOnly: isCI,
    retries: isCI ? 1 : 0,
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

        trace: fullEvidence ? "on" : "retain-on-failure",
        screenshot: fullEvidence ? "on" : "only-on-failure",
        video: fullEvidence ? "on" : "retain-on-failure",

        // Opt-in pacing for watching a run or reviewing its evidence:
        //   PowerShell   $env:SLOWMO=500; npx playwright test ... --headed
        //   bash         SLOWMO=500 npx playwright test ... --headed
        // Defaults to 0, so CI and normal runs are unaffected. This is a
        // viewing aid only — it does not make a step wait for anything, so
        // never reach for it in place of a proper wait.
        launchOptions: { slowMo: Number(process.env.SLOWMO ?? 0) },

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
