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
 * directly from `@playwright/test` for this to take effect — Playwright
 * hooks only apply to tests declared through the same `test` object
 * they're registered on.
 *
 * Override with PACE_BETWEEN_TESTS_MS for a specific run if needed:
 *   PowerShell   $env:PACE_BETWEEN_TESTS_MS=0; npx playwright test ...
 *   bash         PACE_BETWEEN_TESTS_MS=0 npx playwright test ...
 */
export const test = base;
export { expect };

const PACE_BETWEEN_TESTS_MS = Number(process.env.PACE_BETWEEN_TESTS_MS ?? 4000);

test.afterEach(async () => {
  if (PACE_BETWEEN_TESTS_MS > 0) {
    await new Promise((resolve) => setTimeout(resolve, PACE_BETWEEN_TESTS_MS));
  }
});
