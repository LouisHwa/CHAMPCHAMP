import { test, expect } from "../../utils/pacedTest";
import { HeaderBar } from "../../pages/HeaderBar";
import { ProductPage } from "../../pages/ProductPage";
import { CartPage } from "../../pages/CartPage";
import { PRODUCT_HANDLES } from "../../fixtures/test-data";
import { recordUrl } from "../../utils/evidence";

/**
 * TP-02-003 — Verify cart insertion is blocked with an inline validation
 * error when no size is selected. Covers TC-02-003 (#1 to #3).
 *
 * BLOCKED IN FULL — A-011. This is NOT a defect and is no longer marked
 * test.fail(). This theme's inline script auto-selects the first Size and
 * Colour option on page load
 * (`$('.single-option-selector:eq(0)').val("S").trigger('change')`), so
 * "no size selected" is not a reachable state on this store. That is
 * standard platform behaviour preventing a condition from being
 * established, which is an Assumption plus Blocked, never a defect.
 * TCOV-02-003's condition cannot be established.
 *
 * WHAT THIS PROCEDURE ASSERTS. The block is recorded as evidence AND
 * monitored. The step below asserts that the Size dropdown carries a
 * value on page load — the environment fact that makes the block real. If
 * the store ever loads with no size preselected, that goes red and flags
 * A-011 as stale and TC-02-003 as newly executable. It asserts nothing
 * about REQ-F2-02.
 *
 * What is NOT asserted is the requirement: that Add to Cart is refused
 * with an inline validation error. Asserting it against an unreachable
 * condition would report a failure for a case that was never executable,
 * which is exactly what the old test.fail() assertion did.
 *
 * The procedure is still executed in full — Add to Cart is clicked and
 * the system response recorded as evidence — and nothing is deleted.
 * Cleanup (removing any line the click added) still runs so the cart is
 * restored to the ENV-08 baseline for the next procedure.
 *
 * Uses CartPage (a real navigation), not CartDrawer, for both counts.
 * CartDrawer's #drawer is a server-rendered snapshot from page load and
 * does NOT reflect an add performed via AJAX on that same page — a
 * dependency also confirmed by diagnostic run (see CartDrawer.ts). Using
 * it here would silently show the pre-click count and produce a false
 * pass on exactly the behaviour this test exists to catch.
 */
test.describe("FN-02 Product Detail", () => {
    test("TP-02-003 [BLOCKED A-011] Missing size selection validation", async ({
        page,
    }, testInfo) => {
        testInfo.annotations.push({
            type: "blocked",
            description:
                "A-011: the Size and Colour dropdowns are auto-preselected on page load, so the " +
                '"no size selected" state is unreachable. TCOV-02-003 condition cannot be established.',
        });

        const header = new HeaderBar(page);
        const product = new ProductPage(page);
        const cart = new CartPage(page);

        let baselineLineCount = 0;
        let sizeOnLoad = "";

        await test.step("Set Up — confirm empty cart, baseline line count", async () => {
            await cart.goto();
            baselineLineCount = await cart.lineCount();
            await testInfo.attach(
                "Baseline cart line count (expected 0, per ENV-08)",
                {
                    body: String(baselineLineCount),
                    contentType: "text/plain",
                },
            );
            // The attachment above claimed an expectation the code never checked.
            // The TPS Set Up requires the cart to be CONFIRMED empty: ENV-08 is a
            // precondition, so a non-empty cart invalidates the run.
            expect(baselineLineCount).toBe(0);
        });

        await test.step("TC-02-003 #1 — Size dropdown, Add to Cart and Sold Out state on load", async () => {
            await product.goto(PRODUCT_HANDLES.noirJacket);
            await recordUrl(page, testInfo, "Noir jacket PDP");

            // TPS #1 asks for three readings on load, not one: the Size dropdown
            // value, whether Add to Cart is enabled, and whether a Sold Out badge
            // is shown. Taken without operating any variant control.
            const [sizeValue, addToCartEnabled, soldOutBadgeCount] =
                await Promise.all([
                    product.sizeSelect.inputValue(),
                    product.addToCartButton.isEnabled(),
                    page.locator(".sold-out").count(),
                ]);
            sizeOnLoad = sizeValue;

            await testInfo.attach("Variant controls state on page load", {
                body:
                    `Size dropdown: ${sizeOnLoad === "" ? "(no selection)" : sizeOnLoad}\n` +
                    `Add to Cart enabled: ${addToCartEnabled}\n` +
                    `Sold Out badge present: ${soldOutBadgeCount > 0}`,
                contentType: "text/plain",
            });
        });

        await test.step("A-011 block condition — Size is preselected on load (TCOV-02-003 unreachable)", async () => {
            // Not a TC-02-003 step. This is the environment check that makes
            // the block demonstrable rather than assumed, and keeps it
            // monitored: A-004 lets store content and theme change without
            // notice, and we run against live production.
            await testInfo.attach("A-011 — Size dropdown value on page load", {
                body:
                    `Size dropdown on load: ${sizeOnLoad === "" ? "(no selection)" : sizeOnLoad}\n` +
                    `"no size selected" state reachable: ${sizeOnLoad === "" ? "yes" : "no"}\n` +
                    `TCOV-02-003 condition establishable: ${sizeOnLoad === "" ? "yes" : "no"}`,
                contentType: "text/plain",
            });

            // Asserts the ENVIRONMENT, not the requirement. Going red here
            // means the store now loads with no size preselected: A-011 is
            // stale and TC-02-003 must be re-planned as executable. This
            // does NOT assert REQ-F2-02 either way.
            expect(
                sizeOnLoad,
                "A-011 expects the Size dropdown to be auto-preselected on load, which is why " +
                    "TC-02-003 is Blocked. If this fails the store no longer preselects a size: " +
                    "A-011 is stale and TC-02-003 must be re-planned as executable.",
            ).not.toBe("");
        });

        await test.step("TC-02-003 #2 — click Add to Cart without touching Size", async () => {
            const cartAddResponse = page
                .waitForResponse((res) => res.url().includes("/cart/add"), {
                    timeout: 10_000,
                })
                .catch(() => null);
            await product.addToCartButton.click();
            const response = await cartAddResponse;

            const possibleMessage = page.locator(
                '#buy .error, #buy .message, #buy .alert, #buy [class*="error"]',
            );
            const messageText =
                (await possibleMessage.count()) > 0
                    ? await possibleMessage.first().innerText()
                    : null;

            await testInfo.attach("System response after Add to Cart click", {
                body:
                    `/cart/add response: ${response ? response.status() : "not observed within 10s"}\n` +
                    `inline message: ${messageText ?? "none found (no element matching a generic error/message/alert pattern near the control)"}`,
                contentType: "text/plain",
            });
            await testInfo.attach("System response — screenshot", {
                body: await page.locator("#buy").screenshot(),
                contentType: "image/png",
            });
        });

        await test.step("TC-02-003 #3 — cart line count vs baseline", async () => {
            await cart.goto();
            const closingLineCount = await cart.lineCount();
            await testInfo.attach("Closing cart line count", {
                body: `baseline: ${baselineLineCount}\nclosing:  ${closingLineCount}`,
                contentType: "text/plain",
            });

            // The line count is RECORDED, not asserted. TC-02-003's expected
            // result — the insertion refused with an inline validation error —
            // cannot be evaluated, because the condition it depends on ("no
            // size selected") is unreachable under A-011. Asserting it here
            // would report a failure for a case that was never executable.
            // The requirement itself stays stated in the TCS, unchanged.

            // Cleanup still runs: ENV-08 requires the next procedure to start
            // from an empty cart, so any line the click added is removed.
            for (let i = closingLineCount - 1; i >= baselineLineCount; i--) {
                await cart.removeLine(i).click();
            }

            await cart.goto();
            const afterCleanup = await cart.lineCount();
            await testInfo.attach("Cart restored to ENV-08 baseline", {
                body: `line count after cleanup: ${afterCleanup} (baseline ${baselineLineCount})`,
                contentType: "text/plain",
            });
            expect(
                afterCleanup,
                "Cleanup must restore the ENV-08 baseline so the next procedure starts from an empty cart.",
            ).toBe(baselineLineCount);
        });

        await test.step("Wrap Up — return to the store home page", async () => {
            await header.gotoHome();
        });
    });
});
