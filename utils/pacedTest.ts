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
 * Override with PACE_BETWEEN_TESTS_MS for a specific run if needed:
 *   PowerShell   $env:PACE_BETWEEN_TESTS_MS=0; npx playwright test ...
 *   bash         PACE_BETWEEN_TESTS_MS=0 npx playwright test ...
 */
const PACE_BETWEEN_TESTS_MS = Number(process.env.PACE_BETWEEN_TESTS_MS ?? 4000);

export const test = base.extend<{ paceBetweenTests: void }>({
  paceBetweenTests: [
    async ({}, use) => {
      await use();
      if (PACE_BETWEEN_TESTS_MS > 0) {
        await new Promise((resolve) => setTimeout(resolve, PACE_BETWEEN_TESTS_MS));
      }
    },
    { auto: true },
  ],
});

export { expect };
