/**
 * ONE-OFF INVESTIGATION, not a test. Answers a single question:
 *
 *   Is the Reset Account Password page protected by the same hCaptcha that
 *   blocks the login and registration forms?
 *
 * WHY IT MATTERS. If the reset form is NOT gated, then TC-07-016 #4 and
 * TC-07-013 #8/#9 become automatable, which changes the manual/automated
 * split for TP-07-005 and TP-07-006. If it IS gated, those procedures are
 * manual almost end to end and can be planned accordingly.
 *
 * WHY IT HAS TO SUBMIT. The login page carried ZERO captcha markup at page
 * load and only injected hCaptcha on submit (recorded 12 August). So reading
 * the reset page's markup proves nothing — the only conclusive test is to
 * fill the form and submit it.
 *
 * WHICH ACCOUNT. Submitting changes a password, so run this against
 * FRESH_ACCOUNT, never TD-07-ACC. TP-07-005 and TP-07-006 are the procedures
 * that legitimately change TD-07-ACC's credential and the TPS requires them
 * to run last; changing it here would break that ordering and invalidate the
 * working credential every other FN branch's session recapture depends on.
 * FRESH_ACCOUNT is only used by FN-06's TP-06-006, and that reads a
 * transplanted session rather than the password.
 *
 * The reset link is obtained MANUALLY — request it from a normal browser and
 * read it out of the inbox. Requesting a link changes nothing on its own;
 * only submitting the form does.
 *
 * Usage:
 *   node scripts/probe-reset-page.mjs "<reset-url>" [new-password]
 *
 * The reset link is a live credential (SPR-24). Do not commit it, paste it
 * into a shared artefact, or leave it in shell history you intend to share.
 */
import { chromium, devices } from "@playwright/test";

const RESET_URL = process.argv[2];
const NEW_PASSWORD = process.argv[3] ?? "TempPassword123";
const STORE_HOST = "sauce-demo.myshopify.com";

if (!RESET_URL) {
  console.error('Usage: node scripts/probe-reset-page.mjs "<reset-url>" [new-password]');
  console.error("Obtain the reset link manually: request it in a normal browser, read it from the inbox.");
  process.exit(1);
}

try {
  const host = new URL(RESET_URL).hostname;
  if (host !== STORE_HOST) {
    console.error(`Refusing to run: ${host} is not ${STORE_HOST}.`);
    process.exit(1);
  }
} catch {
  console.error("That does not parse as a URL.");
  process.exit(1);
}

/** Matches only a real form submission to the store's customer endpoints. */
function isAccountPost(url, method) {
  try {
    const parsed = new URL(url);
    return parsed.hostname === STORE_HOST && method === "POST" && parsed.pathname.startsWith("/account");
  } catch {
    return false;
  }
}

async function captchaMarkers(page) {
  return {
    elementsFlaggedForCaptcha: await page.locator("[data-cptcha]").count(),
    hcaptchaFrames: await page.locator('iframe[src*="hcaptcha"]').count(),
    recaptchaFrames: await page.locator('iframe[src*="recaptcha"]').count(),
    hcaptchaResponseToken: await page
      .locator('textarea[name="h-captcha-response"]')
      .first()
      .inputValue()
      .catch(() => "(no such field)"),
  };
}

// Matched to the `chromium` project in playwright.config.ts so the result is
// comparable with the login/registration findings.
const browser = await chromium.launch({ headless: false, slowMo: 600 });
const context = await browser.newContext({ ...devices["Desktop Chrome"] });
const page = await context.newPage();

const accountPosts = [];
page.on("response", (response) => {
  if (isAccountPost(response.url(), response.request().method())) {
    accountPosts.push(`${response.status()} POST ${response.url()}`);
  }
});

await page.goto(RESET_URL, { waitUntil: "domcontentloaded" });

console.log("\n=== RESET PAGE AT LOAD ===");
console.log("destination:", page.url());
const atLoad = await captchaMarkers(page);
for (const [k, v] of Object.entries(atLoad)) console.log(`  ${k}: ${v}`);

const passwordField = page
  .locator('input[name="customer[password]"]')
  .or(page.locator("input#password"))
  .first();
const confirmField = page
  .locator('input[name="customer[password_confirmation]"]')
  .or(page.locator("input#password_confirmation"))
  .first();
const submitButton = page.locator('form input[type="submit"], form button[type="submit"]').first();

console.log("\n=== FORM STRUCTURE (TC-07-016 #3 expects a password and a matching confirmation) ===");
console.log("  password field present:     ", (await passwordField.count()) > 0);
console.log("  confirmation field present: ", (await confirmField.count()) > 0);
console.log("  submit control present:     ", (await submitButton.count()) > 0);

if ((await passwordField.count()) === 0 || (await submitButton.count()) === 0) {
  console.log("\nThe form is not where expected — the link may be expired or already consumed.");
  await context.close();
  await browser.close();
  process.exit(1);
}

await passwordField.fill(NEW_PASSWORD);
if ((await confirmField.count()) > 0) await confirmField.fill(NEW_PASSWORD);

console.log("\nSubmitting…");
await submitButton.click();
await page.waitForLoadState("domcontentloaded").catch(() => {});
await page.waitForTimeout(6_000);

const afterSubmit = await captchaMarkers(page);
const messages = (
  await page.locator('.errors, .error, .form-message, [role="alert"], [aria-live]').allInnerTexts()
)
  .map((t) => t.trim())
  .filter(Boolean);
const signedIn = (await page.locator("#customer_logout_link").count()) > 0;

console.log("\n=== AFTER SUBMIT ===");
console.log("landed on:        ", page.url());
console.log("signed in:        ", signedIn);
console.log("POSTs to /account:", accountPosts.length ? accountPosts.join("\n                   ") : "(none)");
console.log("messages shown:   ", messages.length ? messages.join(" | ") : "(none)");
for (const [k, v] of Object.entries(afterSubmit)) console.log(`  ${k}: ${v}`);

console.log("\n=== VERDICT ===");
if (accountPosts.length > 0) {
  console.log("NOT GATED — the submission reached the store.");
  console.log("TC-07-016 #4 and TC-07-013 #8/#9 are automatable.");
  console.log(`FRESH_ACCOUNT's password is now "${NEW_PASSWORD}" — update FRESH_ACCOUNT_PASSWORD in .env.`);
} else if (afterSubmit.hcaptchaFrames > 0 || afterSubmit.elementsFlaggedForCaptcha > 0) {
  console.log("GATED — hCaptcha intercepted the submission; nothing reached the store.");
  console.log("TC-07-016 #4 and TC-07-013 #8/#9 are manual. No password was changed.");
} else {
  console.log("INCONCLUSIVE — no POST and no captcha markup. Read the window before closing it.");
}

console.log("\nLeaving the browser open for 30s so the final state can be seen.");
await page.waitForTimeout(30_000);
await context.close();
await browser.close();
