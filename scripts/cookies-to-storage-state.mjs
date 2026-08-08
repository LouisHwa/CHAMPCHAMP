#!/usr/bin/env node
/**
 * Converts a raw browser `Cookie:` request header into a Playwright
 * storageState file. This is the manual half of the auth workaround
 * documented in auth-setup-guide.md: hCaptcha rejects any
 * CDP-controlled sign-in, so a human signs in normally and this script
 * transplants that session into a file Playwright can load via
 * `test.use({ storageState: ... })`.
 *
 * Usage: node scripts/cookies-to-storage-state.mjs <cookie-header-file>
 *
 * The input is exactly what "Copy value" gives you off the Cookie:
 * request header in DevTools — a single line of "name=value; name=value"
 * pairs. It carries no per-cookie flags (domain/path/expiry/httpOnly),
 * so this script applies the same reasonable defaults to every cookie:
 * the storefront's own domain, path "/", secure, and a 7-day expiry
 * (generous enough to outlast a normal working session without needing
 * to guess whether the original cookie was session-only or persistent).
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const DOMAIN = '.sauce-demo.myshopify.com';
const OUTPUT_PATH = 'playwright/.auth/user.json';
const SEVEN_DAYS_SECONDS = 60 * 60 * 24 * 7;

const inputPath = process.argv[2];
if (!inputPath) {
  console.error('Usage: node scripts/cookies-to-storage-state.mjs <cookie-header-file>');
  process.exit(1);
}

const raw = readFileSync(inputPath, 'utf8').trim();
if (!raw) {
  console.error(`${inputPath} is empty — did the clipboard copy actually capture the Cookie: header?`);
  process.exit(1);
}

const cookies = raw
  .split(';')
  .map((pair) => pair.trim())
  .filter(Boolean)
  .map((pair) => {
    const eq = pair.indexOf('=');
    if (eq === -1) {
      throw new Error(`Malformed cookie pair (no "="): "${pair}"`);
    }
    return {
      name: pair.slice(0, eq).trim(),
      value: pair.slice(eq + 1).trim(),
      domain: DOMAIN,
      path: '/',
      expires: Math.floor(Date.now() / 1000) + SEVEN_DAYS_SECONDS,
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
    };
  });

if (cookies.length === 0) {
  console.error('No cookies parsed out of the input file.');
  process.exit(1);
}

const storageState = { cookies, origins: [] };

mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
writeFileSync(OUTPUT_PATH, JSON.stringify(storageState, null, 2));

console.log(`Wrote ${cookies.length} cookie(s) to ${OUTPUT_PATH}.`);
console.log('Cookie names:', cookies.map((c) => c.name).join(', '));
console.log('Next: node scripts/verify-auth-session.mjs');
