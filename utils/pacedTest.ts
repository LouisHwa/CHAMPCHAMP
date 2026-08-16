import { test as base, expect } from '@playwright/test';

/**
 * A drop-in replacement for `@playwright/test`'s own `test` that adds a
 * pause after every test case finishes. playwright.config.ts's `slowMo`
 * paces individual actions within a test; this is the other half of the
 * same Cloudflare mitigation — "a few seconds between test cases" per
 * the lecturer's guidance — since slowMo alone doesn't add any gap
 * between one test ending and the next one starting.
 *
 * Every spec file must import `test`/`expect` from here instead of
 * directly from `@playwright/test`, or that file's tests get no pause.
 *
 * Implemented as an auto fixture, NOT a module-scope `test.afterEach`.
 * A bare `test.afterEach()` here would attach to whichever spec file
 * happened to trigger this module's evaluation — Node caches the module,
 * so with workers=1 every later spec file in the same run silently got
 * no pause at all. An auto fixture is per-test and applies everywhere.
 *
 * The pause is drawn fresh for each test rather than being the fixed
 * 4000ms it used to be, so a run's request pattern against the store is
 * not perfectly metronomic. The range starts AT the old fixed value and
 * only ever goes up, so no test is ever paced less than it was before.
 *
 * What this does and does not mitigate:
 *   - Cloudflare / rate-based detection: yes. Request volume and rate
 *     from one IP is what tripped the interstitial on 7 August, and
 *     A-009 requires automated execution to be paced regardless.
 *   - The hCaptcha on the login and registration forms: no. That is
 *     scored per submission on the browser's fingerprint and behaviour
 *     at that moment, and is indifferent to what happened seconds
 *     earlier, between two tests.
 *
 * Overrides for a specific run:
 *   PACE_BETWEEN_TESTS_MS       pin to one fixed value; 0 disables the
 *                               pause entirely (debugging a single spec
 *                               only — never a real run against the
 *                               live store)
 *   PACE_BETWEEN_TESTS_MIN_MS   move the lower bound of the range
 *   PACE_BETWEEN_TESTS_MAX_MS   move the upper bound of the range
 *
 *   PowerShell   $env:PACE_BETWEEN_TESTS_MS=0; npx playwright test ...
 *   bash         PACE_BETWEEN_TESTS_MS=0 npx playwright test ...
 */
const PACE_FIXED_MS = process.env.PACE_BETWEEN_TESTS_MS;
const PACE_MIN_MS = Number(process.env.PACE_BETWEEN_TESTS_MIN_MS ?? 4000);
const PACE_MAX_MS = Number(process.env.PACE_BETWEEN_TESTS_MAX_MS ?? 7000);

/**
 * A fixed override wins outright, including 0, so the documented
 * "switch it off" escape hatch still behaves the way it always did.
 */
function pauseMs(): number {
  if (PACE_FIXED_MS !== undefined) return Number(PACE_FIXED_MS);
  return PACE_MIN_MS + Math.floor(Math.random() * (PACE_MAX_MS - PACE_MIN_MS + 1));
}

export const test = base.extend<{ paceBetweenTests: void }>({
  paceBetweenTests: [
    async ({}, use) => {
      await use();
      const ms = pauseMs();
      if (ms > 0) {
        await new Promise((resolve) => setTimeout(resolve, ms));
      }
    },
    { auto: true },
  ],
});

export { expect };
