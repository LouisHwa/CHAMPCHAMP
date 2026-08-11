# Signed-in test setup — guide for the team

Committed at the repo root deliberately: `docs/` is gitignored, so a guide
kept there cannot reach the rest of the team. Anyone implementing
account-related tests needs this file and the two scripts in `scripts/`.

**Read this before writing any signed-in spec.** The login form cannot be
automated, so the session is established by hand and reused. This takes
about five minutes the first time and two minutes on each repeat.

---

## Background in one paragraph

The store's login and register forms are hCaptcha-protected and reject any
browser Playwright drives — confirmed against both bundled Chromium and real
Chrome. hCaptcha is detecting the Chrome DevTools Protocol, which is how
Playwright drives every browser, so no browser channel avoids it. Instead, a
human signs in normally, and that session is transplanted into Playwright as
a `storageState` file. Full detail in `auth-discovery-log.md`.

## One-time setup

### 1. Install and check out

```powershell
git checkout fn04-cart-management
npm ci
npx playwright install
```

`npm ci` matters — this branch adds `dotenv`, `imapflow` and `mailparser`,
and [playwright.config.ts](playwright.config.ts) imports `dotenv/config`
on its first line. Without them the config will not load and **no tests run
at all**.

### 2. Create your `.env`

Copy `.env.example` to `.env` at the repo root and fill in the six values.
`.env` is gitignored and must stay that way.

```
TEST_ACCOUNT_EMAIL=
TEST_ACCOUNT_PASSWORD=
IMAP_HOST=imap.gmail.com
IMAP_PORT=993
IMAP_USER=
IMAP_APP_PASSWORD=
```

The IMAP password is a Gmail **App Password**, not the account password.
Ask the person who owns the test account for these — per SPR-24, credentials
are test data and must not appear in any shared or published artefact, so
they are not written down here.

`.env` is only needed for tests that read the mailbox (order confirmation,
password reset). Cart and checkout tests do not use it.

## Capturing a signed-in session

Repeat this whenever the session expires.

1. Open **Chrome normally** — from the Start menu. Not through `npx`, not
   through `npm run`. This is the whole point: no CDP is attached.
2. Sign in at `https://sauce-demo.myshopify.com/account/login` and solve the
   captcha yourself.
3. Confirm `https://sauce-demo.myshopify.com/account` shows the account page.
4. Press `F12` → **Network** tab → reload the page (`F5`).
5. Click the **top entry** in the request list (the document request).
6. **Headers** → **Request Headers** → right-click the `Cookie:` line →
   **Copy value**.
7. In a **PowerShell** terminal at the repo root (not Git Bash —
   `Get-Clipboard` is a PowerShell cmdlet):

   ```powershell
   Get-Clipboard -Raw | Set-Content -Encoding utf8 cookie-header.txt
   npm run auth:cookie-to-state cookie-header.txt
   npm run auth:verify
   Remove-Item cookie-header.txt
   ```

Step 3 should print `VERDICT: SIGNED IN — session transferred`. If it says
SIGNED OUT, you were not signed in when you copied the header, or you copied
the **Response** headers rather than the Request headers.

`playwright/.auth/user.json` now holds a live session. It is gitignored.
Never commit it, and never attach it to a report (SPR-24).

### Do not use these

- **`document.cookie` in the console** — the session cookie is `httpOnly`
  and invisible to JavaScript. You will get an incomplete capture.
- **Cookie-Editor** — its export is encrypted when a password is set, and
  this build offers no unencrypted option.
- **`npm run auth:setup*`** — the codegen scripts in `package.json`. They
  hit the captcha. Left in place only for the record.

## Writing a signed-in spec

Opt in per file:

```ts
import { test, expect } from '@playwright/test';

test.use({ storageState: 'playwright/.auth/user.json' });

test.describe('FN-06 My Account', () => {
  test('TP-06-001 ...', async ({ page }, testInfo) => {
    // starts already signed in
  });
});
```

Per file, never globally. [playwright.config.ts](playwright.config.ts)
sets `storageState: undefined` so every other test starts clean per ENV-01.
A spec opting in this way is declaring **ENV-02** instead, which keeps the
two environmental needs separated in the report.

The sign-out control is `#customer_logout_link` → `/account/logout`. It
appears **twice** on the page (header and sidebar), so scope it — use
`.first()` or scope to a container, or Playwright strict mode will fail the
locator. The duplication is recorded as out of scope by SPR-06; it is not a
defect to raise.

## What you can and cannot automate

| | |
|---|---|
| Start signed in (ENV-02 precondition) | Yes |
| Sign out as a procedure step | Yes — plain link click, no captcha |
| Sign **in** as a procedure step | **No** — captcha-protected |
| Reload the saved session after a sign-out | **No** — it dies with the sign-out (verified) |

So **TC-04-011 and TC-04-013 are automatable up to the sign-out and blocked
at the re-sign-in**, and should be recorded as manual-execution-only in the
test plan. Anything needing only a signed-in *starting state* is fine.

**TC-04-012 needs no account at all** — it is guest-cart persistence,
ENV-08 only. Buildable today with no captcha involvement.

## Before you run the full suite

Verify the session first, or signed-in specs will silently run signed out
and assert against the wrong state:

```powershell
npm run auth:verify
```

There is also a fuller check that signs in, signs out, and confirms the
saved session dies with the sign-out. It lives in `tests/_infra`, which is
excluded from the suite because it discharges no TCS coverage item, so it
needs the `INFRA` gate — and note it **invalidates your session**, so
re-capture afterwards:

```powershell
$env:INFRA=1; npx playwright test tests/_infra/auth-session.spec.ts --project=chromium
$env:INFRA=""
```

## Capture it immediately before you need it

A sign-out kills the session **server-side**, so every copy of the file dies
at once — verified: a fresh context loading the same `user.json` after a
sign-out is bounced to `/account/login`. Several procedures sign out as part
of their own steps, and therefore destroy the session they depend on:

| Procedure | Effect |
|---|---|
| `tests/_infra/auth-session.spec.ts` | signs out by design — always invalidates |
| TP-04-006 cart resumption | signs out mid-procedure |
| TP-05-006 signed-in checkout | signs out in Wrap Up |

So capture right before the run that needs it, and expect to re-capture
afterwards. Don't capture "in advance" for a session of work.

## Don't send `user.json` to a teammate

It holds a live session token, so it's the same class of thing as a
password — SPR-24 applies. The file is portable (it's only cookies, with no
machine or browser affinity), but each person should spend the two minutes
capturing their own rather than passing one around.

## If the store challenges you

Cloudflare has served a "Your connection needs to be verified before you can
proceed" interstitial during ordinary signed-out runs, on more than one
machine. A run taken while that is active is **invalid, not a test failure** —
check the trace for that text before recording any result. Pacing
(`workers: 1`, `slowMo`, the `pacedTest` gap) reduces it but has not
eliminated it.

## Traffic

Assumption A-005 forbids abnormal traffic against the live store. Cloudflare
already served an interstitial during a signed-out FN-04 batch on 7 August.
Keep `workers: 2`, run in small batches, and treat any result taken while a
challenge is active as **invalid** rather than as a test failure — check the
trace for "Your connection needs to be verified" before believing a failure.

## Never

Do not build anything that solves captcha challenges programmatically —
image recognition, third-party solving services, or similar. That is
circumventing anti-bot protection, not testing. If a scenario cannot be
reached with a human-established session, flag it manual in the test plan.
