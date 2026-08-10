# FN-06 test run instructions (temporary)

Prerequisites to check **before** running each `tp-06-00X` spec, so a run doesn't fail on a stale session instead of testing anything real.

## The core issue

Every FN-06 spec that needs a signed-in shopper uses a **transplanted session** (`playwright/.auth/user.json` for `TEST_ACCOUNT`, or `playwright/.auth/fresh-user.json` for the ENV-14 fresh account) instead of a live login — the login form is hCaptcha-protected and rejects any Playwright-driven browser.

Several specs also perform a **real sign-out** (`HeaderBar.logOutLink`) as part of the test itself (it's a genuinely automatable action, unlike login). A real sign-out invalidates that session **server-side** — so after one of these specs finishes, `user.json` is dead and must be recaptured before running another signed-in spec, even a different one.

**Always run `npm run auth:verify` first.** If it says `SIGNED OUT`, recapture before running anything.

## Recapture pipeline

In a normal (non-Playwright) browser, signed in as the account you need:

```powershell
Get-Clipboard -Raw | Set-Content -Encoding utf8 cookie-header.txt
npm run auth:cookie-to-state -- cookie-header.txt playwright/.auth/user.json
npm run auth:verify -- playwright/.auth/user.json
Remove-Item cookie-header.txt
```

To get the cookie value: DevTools (F12) → Network tab → click any request to `sauce-demo.myshopify.com` (a Doc-type request is easiest, e.g. reload `/account`) → Headers → Request Headers → copy the full `Cookie:` value.

**If `auth:verify` still says `SIGNED OUT` after a recapture**, the tab you copied from was probably still holding the *same* now-dead token (a prior test's sign-out invalidates it everywhere, not just in Playwright) — you need to actually **log in again with real credentials**, not just find an already-open tab.

## Per-file prerequisites

| File | Session needed | Signs out for real? | Notes |
|---|---|---|---|
| `tp-06-001-address-field-validation` | `user.json` (TEST_ACCOUNT) | Yes, at Wrap Up | Empties/rebuilds the address book repeatedly during the run |
| `tp-06-002-address-book-count-and-default` | `user.json` | Yes, at Wrap Up | Assumes address book starts empty |
| `tp-06-003-address-row-edit-state` | `user.json` | Yes, at Wrap Up | Creates 2 throwaway addresses, deletes them by ID (won't touch pre-existing ones) |
| `tp-06-004-wishlist-state-transition` | `user.json` | Yes, at Wrap Up (unconditional, even though the wishlist check itself stops early) | Expected to fail — DEF-F6-03 |
| `tp-06-005-account-address-journey` | `user.json`, loaded into **3 separate contexts** across the run | Yes, twice, at Wrap Up | Two-browser procedure; needs the file to still be valid partway through since it re-loads it mid-test |
| `tp-06-006-my-account-empty-state` | `fresh-user.json` (ENV-14 fresh account) — **independent of `user.json`** | Yes, at Wrap Up | Doesn't touch or depend on `user.json` at all |
| `tp-06-007-order-detail-status-and-reorder` | `user.json`, AND a real completed order (2+ items) must already exist under that account | Yes, mid-test (TC-06-017 #2), then continues as guest | The order itself only needs to exist once — already satisfied (order #1941) — but the session still needs to be fresh going in |

## Running one

```powershell
npx playwright test tests/fn06-account-and-address/tp-06-00X-<name>.spec.ts --project=chromium
```

Never add `--reporter=line` — it replaces the config's reporters (including the HTML one) instead of adding to them.

## Viewing the report

```powershell
npx playwright show-report
```

Then open http://localhost:9323. If the port's already in use from a previous run, the existing server usually still works after a refresh — no need to restart it.
