# FN-05 Checkout — remaining work

**Branch:** `fn05-checkout` (not merged to `main`)
**Test basis:** `TPS FN-05_V2.docx` (the V2 document — supersedes the original `TPS FN-05.docx`)
**Status:** code is aligned with V2 and typechecks clean. **Live testing is only partly done.**

---

## Testing status

| Procedure | Run? | Result |
|---|---|---|
| TP-05-001 checkout entry | Yes | **Passed** end to end, sign-out verified |
| TP-05-002 shipping destination and cost | Partly | **Failed** — see below |
| TP-05-003 payment field validation | **No** | Never run |
| TP-05-004 payment outcome | **No** | Never run |
| TP-05-005 guest purchase, route and billing | **No** | Never run |
| TP-05-006 signed-in checkout | **No** | Never run |

**TP-05-002 through TP-05-006 all still need to be tested.** Only TP-05-001 is confirmed green.

### TP-05-002 detail

Got two-thirds of the way, then hit a **Cloudflare "Verify you are human" interstitial** — an environment problem, not a code fault.

Ran and passed, with evidence captured:

- TC-05-002 #1 UK rate, #2 France recalculation, #3 blank destination, #4 unsupported destination
- TC-05-011 #1 oracle, #2 France rate

Figures observed: Grey jacket £55.00 ×1 + Bronze sandals £39.99 ×1 → subtotal £94.99; UK shipping £10.00 → total £104.99; France shipping £20.00 → total £114.99. All correct.

Never ran:

- **TC-05-012 #1, #2, #3** — Cloudflare hit on the cart build immediately before them
- **The Wrap Up** — so that run left the cart dirty; empty it before the next run

### Watch this on the TP-05-002 re-run

TC-05-002 #3 recorded **no validation message at all**. The attachment lists only "Pay now" and "Apply" as live-region text, with all five expected messages ("Enter an address", "Enter a city", "Enter a postcode", "Select a country", "not available") explicitly not shown. The step still passed, because its assertion is `expect.soft(url).toContain('/checkouts/')` and checkout did correctly refuse to proceed.

"Refused silently, with no message naming the incomplete fields" is a different outcome from what SPR-23 expects. That may be a genuine **defect candidate for the Defect Log** — but confirm it reproduces on a clean run first, since the `Pay now` click may simply not have registered.

---

## What this commit changed

### V2 alignment (TD-05-B added)

V2 adds a second bound test datum, **TD-05-B (Bronze Sandals)**, alongside TD-05-A (Grey Jacket). Its own note explains why: TD-05-B is added "wherever a step asserts the order total as the sum of the line totals under SPR-12, since that assertion is not meaningful against a single line, and in TP-05-006, whose completed order must hold at least two items to satisfy ENV-15 for TC-06-018."

- `_helpers.ts` — `addProductAndGoToCheckout(page, includeSecondProduct)` flag, new `addSecondProduct()`, extracted `selectVariantAndAddToCart()`, new `recordLineItems()` (SPR-12: records each line's name, quantity and price and returns their sum)
- `CheckoutPage.ts` — new `shoppingCartTable` plus `lineItemRow` / `lineItemQuantity` / `lineItemPrice`, built from a live DOM capture of the order-summary table
- TP-05-002, TP-05-005, TP-05-006 — carts are now two-item; every SPR-12 step asserts `sum of line totals ≈ subtotal`
- TP-05-002 — removed the "TCS correction required" note; V2 no longer carries it, the gap was fixed upstream in the TCS

### Bugs fixed

Found during review, before any test was run:

1. **Missing Wrap Up in TP-05-003 and TP-05-004.** Both files simply ended after the last test case, although the TPS (V1 *and* V2) requires a Wrap Up. Implemented in both.
2. **TP-05-005 TC-05-009 reset** called `product.addToCartButton.click()` without first navigating to a product page. Latent pre-existing bug; now navigates properly.
3. **TP-05-005 wrong email link text** — `extractLink(email.html, 'View order')`. The real Shopify button reads **"View your order"**, and `extractLink` needs a literal contiguous match, so it silently found nothing. Known from FN-06 work but never back-ported. Fixed.

Found by actually running the tests:

4. **TP-05-001 signed-in route never navigated.** `addProductAndReachCheckout` took a page parameter but used the *outer closure's* `catalog`, which is bound to the guest page. The signed-in call therefore drove the guest browser while `signedIn.page` sat on `/account`, so `#add` timed out. Now builds a `CatalogPage` from the page passed in.
5. **The shared helper added the wrong product.** `addProductAndGoToCheckout` clicked the first catalogue tile as "TD-05-A" — but the live grid order is **Black heels** → Bronze sandals → Brown Shades → Grey jacket. With a one-item cart nothing ever checked the name, so it went unnoticed for the whole project; V2's `recordLineItems` matches lines by name, and TD-05-A came back "(not found), £NaN". Now navigates by handle. The same bug was still latent in **TP-05-006's** inline cart build and has been fixed there too.
6. **`costSummaryRow` matched the rowheader with `exact: true`.** Confirmed live: once the cart holds more than one line the rowheader reads **"Subtotal · 2 items"**, not "Subtotal", so the locator silently matched nothing. Now a start-anchored regex — which still stops `Total` matching `Subtotal ·…` or the sibling "Including £x in taxes" row. This would have broken TP-05-005 in exactly the same way.

### Infrastructure

- `playwright.config.ts` — `timeout: 30_000` → `90_000`. This branch never received wenPen20's earlier fix (it reached `fn04-cart-management`, then `main` via merge, but `fn05-checkout` was worked independently). With `slowMo: 600`, a ~50-action procedure spends 30s on pacing alone; TP-05-001 was being killed mid-run because of it.

---

## How to carry on — the process to follow

Do **not** just run a procedure and read the pass/fail line. The workflow that surfaced bugs 4, 5 and 6 above is:

1. **Check state before running.** Confirm the branch, and for anything needing sign-in run `npm run auth:verify -- playwright/.auth/user.json`. A stale session wastes a whole run.
2. **Run one procedure at a time**, never the whole suite. `workers: 1` and pacing exist to stay under Cloudflare's radar.
3. **On failure, read the actual evidence — don't guess.** Open `test-results/<...>/test-failed-1.png` and the attachments. Every bug above was diagnosed from a screenshot; each one looked like a different problem before the screenshot was opened.
4. **Separate a product defect from a harness bug.** A real store defect gets recorded (soft-assert, evidence attached, raised for the Defect Log). A bug in our own test code gets fixed. Bugs 4–6 were all ours.
5. **Never guess a locator.** If a new one is needed, capture the live DOM with a throwaway script first, then delete the script. That is how the "Subtotal · 2 items" rowheader was found — it is not guessable.
6. **Typecheck before re-running**: `npx tsc --noEmit -p .`
7. **Re-run and repeat** until the procedure passes end to end.
8. **Confirm the Wrap Up actually ran.** This matters: a hard `expect()` failure inside a `test.fail()`-marked section bails out immediately and skips everything after it — *including the Wrap Up* — while still reporting the test as passed. The reliable check is `npm run auth:verify` afterwards: if the Wrap Up signs out but the session still reads SIGNED IN, the Wrap Up never ran and something failed upstream.
9. **Only then serve the report** — `npx playwright show-report` (localhost:9323) — for review.
10. **Never retry straight after a Cloudflare hit.** Per `playwright.config.ts`: a retry immediately re-hits the live site after a failure that may itself have been Cloudflare — no benefit, just more traffic. Cool down ~10 minutes, and consider `$env:SLOWMO=1000` for the long procedures.

---

## Things to know before running the rest

- **These procedures place four real orders on the live storefront** — one in TP-05-004, two in TP-05-005, one in TP-05-006. That is why `playwright.config.ts` excludes `fn05-checkout` from CI (SPR-18 allows no more orders than the test cases require; A-005 forbids unattended actions that modify the system). **Run these manually and attended, never in CI.**
- **TP-05-006 needs a freshly captured signed-in session** at `playwright/.auth/user.json`. The login form is hCaptcha-protected and cannot be automated, so the session is transplanted — see `auth-setup-guide.md`. Capture it immediately before the run; it expires.
- **TP-05-002 is the longest procedure** (three full cart builds, each followed by a checkout) and is the most likely to trip Cloudflare. It is worth running on its own with extra pacing.
- **TP-05-006's completed order feeds FN-06.** Its order must hold at least two items to satisfy ENV-15 for TC-06-018 — that is the whole reason V2 introduced TD-05-B. FN-06's TP-06-007 currently works around this by reading whatever real order already exists; once TP-05-006 runs green, that workaround could be revisited.
- **Empty the cart before the next TP-05-002 run.** The Cloudflare failure skipped its Wrap Up.
