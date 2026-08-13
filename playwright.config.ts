import { defineConfig, devices } from "@playwright/test";

/**
 * SDSS automated suite — MSTB TDC 2.0, Young & Broke
 * Test basis: SDSS_TCS_1_1.0.0 / SDSS_TPS_1_1.0.0
 *
 * Evidence settings below implement the Special Procedural Requirements:
 *   SPR-01  destination URL recorded at every navigation  -> trace
 *   SPR-04  screenshot + URL captured on any failed step  -> screenshot + trace
 */
// run this first 'npm install --save-dev allure-playwright'

const isCI = !!process.env.CI;

export default defineConfig({
    testDir: "./tests",

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
    // with slowMo: 600 — every action carries an extra 0.6s, so a
    // procedure with ~50 actions spends 30s on pacing alone. Confirmed
    // live on other branches: runs were being killed mid-procedure at
    // exactly 30s, which also loses the Wrap Up.
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

        // "on" rather than retain/only-on-failure: these runs ARE the
        // recorded evidence for the test log, so a procedure that passes
        // needs its trace and screenshots just as much as one that fails —
        // a pass with no evidence cannot be shown to have been executed.
        // The trace also carries the per-step DOM snapshots and the
        // destination URL at every navigation, which is what SPR-01 asks
        // for and what SPR-04 needs when a step does fail.
        trace: "on",
        screenshot: "on",
        // "on", not "retain-on-failure": these runs are the recorded
        // evidence for the test log, so a passing procedure needs its
        // video just as much as a failing one. Matches what FN-06's
        // manually created contexts produce, where recording is always on
        // and the file is attached when the context closes.
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
