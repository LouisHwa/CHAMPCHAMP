import { test, expect } from '@playwright/test';

// =============================================================================
// Sauce Demo Shopify Store — Playwright smoke tests
// Test basis: SRS_Sauce_Demo_Shopify_Store v1.0.0 (DRAFT)
// AUT: https://sauce-demo.myshopify.com/
//
// Two tests, chosen to demonstrate the tool:
//   1. A PASSING test  -> verifies a requirement the build conforms to.
//   2. A FAILING test  -> documents a known defect from the SRS. The red is
//                         expected; it is the bug, not a setup problem.
//
// Run:  npx playwright test tests/example.spec.ts --reporter=list
// =============================================================================

const BASE_URL = 'https://sauce-demo.myshopify.com/';

// -----------------------------------------------------------------------------
// TEST 1 — EXPECTED TO PASS
// Traces to: FR-NV-03 "Redirect to the Catalog (collections/all) page when
//            'Catalog' is clicked." (Priority M — Conforms to expected behaviour)
//
// Demonstrates: navigation, a role-based locator, click auto-waiting,
//               URL assertion, and a visibility assertion.
// -----------------------------------------------------------------------------
test('FR-NV-03: Catalog menu link routes to the all-products collection', async ({ page }) => {
  // 1. Open the storefront home page.
  await page.goto(BASE_URL);

  // Sanity check we are on the right site before we interact.
  await expect(page).toHaveTitle(/Sauce Demo/i);

  // 2. Click the "Catalog" navigation link.
  //    getByRole finds it by its accessible name, the way a user would read it.
  await page.getByRole('link', { name: 'Catalog' }).click();

  // 3. We should land on the all-products collection page.
  await expect(page).toHaveURL(/\/collections\/all/);

  // 4. And that page should actually list at least one product.
  //    Any product link contains "/products/" in its href.
  await expect(page.locator('a[href*="/products/"]').first()).toBeVisible();
});

// -----------------------------------------------------------------------------
// TEST 2 — EXPECTED TO FAIL (documents a defect)
// Traces to: FR-NV-04 / FR-BL-04 "...the label shall match the destination."
//            Observed deviation: the "Blog" label opens a page titled "News".
//
// We assert the INTENDED behaviour from the SRS (label matches destination).
// Because the build violates it, this test fails — and that failure IS the
// evidence of the defect. Expect one red result when you run the suite.
// -----------------------------------------------------------------------------
test('FR-NV-04: "Blog" navigation label should match its destination page', async ({ page }) => {
  await page.goto(BASE_URL);

  // Click the navigation item labelled "Blog".
  await page.getByRole('link', { name: 'Blog' }).click();

  // It does navigate somewhere — confirm where it actually lands.
  // (This intermediate check passes; it shows the destination for context.)
  await expect(page).toHaveURL(/\/blogs\/news/);

  // The requirement: a link labelled "Blog" should lead to a "Blog" page.
  // The build serves a page titled "News" instead, so this assertion FAILS.
  await expect(page).toHaveTitle(/Blog/i);
});