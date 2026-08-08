#!/usr/bin/env node
/**
 * Confirms playwright/.auth/user.json actually holds a signed-in
 * session before trusting it in a test run. Signed-in specs opt into
 * this storageState via test.use() (see auth-setup-guide.md); if the
 * captured session is stale or was captured while signed out, those
 * specs would otherwise fail confusingly deep into a test rather than
 * with a clear cause.
 *
 * Usage: node scripts/verify-auth-session.mjs
 */
import { existsSync } from 'node:fs';
import { chromium } from '@playwright/test';

const STORAGE_STATE_PATH = 'playwright/.auth/user.json';
const BASE_URL = 'https://sauce-demo.myshopify.com';

if (!existsSync(STORAGE_STATE_PATH)) {
  console.log(`VERDICT: NO SESSION FILE — ${STORAGE_STATE_PATH} does not exist. Run the capture steps in auth-setup-guide.md first.`);
  process.exit(1);
}

const browser = await chromium.launch();
const context = await browser.newContext({ storageState: STORAGE_STATE_PATH });
const page = await context.newPage();

try {
  await page.goto(`${BASE_URL}/account`, { waitUntil: 'domcontentloaded' });

  // Signed-in: the account page renders with a working #customer_logout_link.
  // Signed-out: Shopify redirects /account -> /account/login instead.
  const signedOut = page.url().includes('/account/login');
  const logoutLinkVisible = await page.locator('#customer_logout_link').first().isVisible().catch(() => false);

  if (!signedOut && logoutLinkVisible) {
    console.log('VERDICT: SIGNED IN — session transferred');
    process.exitCode = 0;
  } else {
    console.log(`VERDICT: SIGNED OUT — landed on ${page.url()}`);
    console.log('Re-capture the session: you likely copied the Response headers instead of the Request headers, or were not actually signed in when you copied.');
    process.exitCode = 1;
  }
} finally {
  await browser.close();
}
