/**
 * Converts a browser cookie export into Playwright's storageState format.
 *
 * Needed because the store's login form is hCaptcha-protected and rejects
 * any browser Playwright drives, regardless of channel — confirmed against
 * bundled Chromium and against real Chrome. The session therefore has to be
 * established by a human in a normal browser window, outside Playwright,
 * and handed over as cookies.
 *
 * Accepts either of two inputs, auto-detected:
 *   1. A Cookie-Editor / EditThisCookie style JSON array (UNENCRYPTED).
 *   2. A raw Cookie request header, copied from DevTools > Network >
 *      (document request) > Request Headers > Cookie. This is the more
 *      reliable source: it includes httpOnly cookies, and the browser only
 *      sends the store's own cookies on that request, so third-party ad and
 *      social trackers never enter the file.
 *
 * Usage:
 *   node scripts/cookies-to-storage-state.mjs <input-file> [output.json]
 *
 * Output defaults to playwright/.auth/user.json, which is gitignored — the
 * file holds a live session token and must never be committed or attached
 * to a report (SPR-24).
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const [, , inputPath, outputPath = "playwright/.auth/user.json"] = process.argv;
const HOST = "sauce-demo.myshopify.com";

if (!inputPath) {
  console.error("Usage: node scripts/cookies-to-storage-state.mjs <input-file> [output.json]");
  process.exit(1);
}

/** Cookie-Editor writes lax/strict/no_restriction; Playwright wants Lax/Strict/None. */
function sameSite(value) {
  switch (String(value ?? "").toLowerCase()) {
    case "strict":
      return "Strict";
    case "no_restriction":
    case "none":
      return "None";
    default:
      return "Lax";
  }
}

const source = readFileSync(inputPath, "utf8").trim();
let cookies;
let dropped = 0;

if (source.startsWith("[") || source.startsWith("{")) {
  const raw = JSON.parse(source);
  const list = Array.isArray(raw) ? raw : raw.cookies;
  if (!Array.isArray(list)) {
    console.error("No cookie array found. If this is an encrypted export, re-export without a password.");
    process.exit(1);
  }
  // Keep only the store's own cookies: an export taken in a normal browser
  // also carries third-party trackers belonging to whoever ran it.
  const store = list.filter((c) => String(c.domain ?? "").includes("myshopify.com"));
  dropped = list.length - store.length;
  cookies = store.map((c) => ({
    name: c.name,
    value: c.value,
    domain: c.domain,
    path: c.path || "/",
    expires: c.session || !c.expirationDate ? -1 : Math.round(c.expirationDate),
    httpOnly: Boolean(c.httpOnly),
    secure: Boolean(c.secure),
    sameSite: sameSite(c.sameSite),
  }));
} else {
  // Raw "Cookie:" header — name=value pairs separated by "; ". The header
  // carries no metadata, so these are written as host-only session cookies,
  // which is what a transplanted browser session needs anyway.
  cookies = source
    .replace(/^Cookie:\s*/i, "")
    .split(/;\s*/)
    .filter(Boolean)
    .map((pair) => {
      const index = pair.indexOf("=");
      return {
        name: pair.slice(0, index).trim(),
        value: pair.slice(index + 1).trim(),
        domain: HOST,
        path: "/",
        expires: -1,
        httpOnly: false,
        secure: true,
        sameSite: "Lax",
      };
    })
    .filter((c) => c.name);
}

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, JSON.stringify({ cookies, origins: [] }, null, 2));

console.log(`Wrote ${cookies.length} cookies to ${outputPath}`);
if (dropped > 0) console.log(`Dropped ${dropped} third-party cookie(s).`);
console.log("Cookie names (values never printed):");
for (const c of cookies) console.log(`  ${c.name}`);

// Which cookie carries the signed-in identity depends on the store's account
// setup: classic customer accounts use secure_customer_sig, newer Shopify
// consolidates session state into _shopify_essential. Report rather than
// assume — the real proof is loading the file and seeing whether the account
// page renders signed in.
const sessionish = cookies.filter((c) =>
  ["secure_customer_sig", "_secure_session_id", "_shopify_essential"].includes(c.name) && c.value,
);
console.log(
  sessionish.length
    ? `\nPossible session cookies present: ${sessionish.map((c) => c.name).join(", ")}`
    : "\nWARNING: no recognised session cookie found.",
);
