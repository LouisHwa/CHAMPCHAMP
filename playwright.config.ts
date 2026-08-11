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
    // test.fail() then reported as an expected failure. Specs that already
    // set their own budget (TP-04-001/002 at 90s, TP-04-006 at 120s) are
    // unaffected; this brings everything else in line with them.
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

        trace: fullEvidence ? "on" : "retain-on-failure",
        screenshot: fullEvidence ? "on" : "only-on-failure",
        video: fullEvidence ? "on" : "retain-on-failure",

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
        // still cuts in at 90s.
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
