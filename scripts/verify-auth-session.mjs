/**
 * Reports whether playwright/.auth/user.json is still a signed-in session.
 *
 * Sessions transplanted from a real browser expire, and an expired one fails
 * silently: specs load the file, run signed out, and assert against the wrong
 * state. Run this before trusting a signed-in spec run.
 *
 * Prints only structural facts — never cookie values or account details.
 *
 * Usage: node scripts/verify-auth-session.mjs [path-to-storage-state]
 */
import { chromium } from "@playwright/test";

const statePath = process.argv[2] ?? "playwright/.auth/user.json";

const browser = await chromium.launch();
const context = await browser.newContext({ storageState: statePath });
const page = await context.newPage();

await page.goto("https://sauce-demo.myshopify.com/account", { waitUntil: "domcontentloaded" });

const finalUrl = page.url();
const bodyText = await page.locator("body").innerText().catch(() => "");

const redirectedToLogin = /\/account\/login/.test(finalUrl);
const hasPasswordField = (await page.locator('input[type="password"]').count()) > 0;
const hasLogout = /log ?out|sign ?out/i.test(bodyText);

console.log("state file:            ", statePath);
console.log("final URL:             ", finalUrl);
console.log("redirected to login:   ", redirectedToLogin);
console.log("password field present:", hasPasswordField);
console.log("logout control present:", hasLogout);
console.log(
  "\nVERDICT:",
  !redirectedToLogin && !hasPasswordField
    ? "SIGNED IN — session transferred"
    : "SIGNED OUT — session did not transfer",
);

await browser.close();
