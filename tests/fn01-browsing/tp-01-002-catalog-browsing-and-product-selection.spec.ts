import { test, expect } from '../../utils/pacedTest';
import { HeaderBar } from '../../pages/HeaderBar';
import { SidebarNav } from '../../pages/SidebarNav';
import { CatalogPage } from '../../pages/CatalogPage';
import { ProductPage } from '../../pages/ProductPage';
import { PRODUCTS, PRODUCT_HANDLES, ROUTES } from '../../fixtures/test-data';
import { recordUrl } from '../../utils/evidence';

/**
 * TP-01-002 — Verify the catalogue lists products and that selecting one
 * opens the correct product detail page with an accurate breadcrumb and
 * parent collection. Covers TC-01-002 (#1 to #4).
 *
 * Intercase dependency: TP-01-001's Catalog navigation step must have
 * passed. Run tp-01-001 first; this spec does not re-verify that step
 * itself, only depends on it having been established.
 *
 * Step 6's parent-collection branch is evaluated dynamically from the
 * actual breadcrumb segment count rather than assumed, since only Black
 * heels' breadcrumb ("Home — Black heels", no parent segment) has been
 * confirmed directly — Grey jacket is assumed to follow the same theme
 * template but hasn't been checked in isolation.
 */
test.describe('FN-01 Product Browsing and Navigation', () => {
  test('TP-01-002 catalogue listing and product selection', async ({ page }, testInfo) => {
    const header = new HeaderBar(page);
    const sidebar = new SidebarNav(page);
    const catalog = new CatalogPage(page);
    const product = new ProductPage(page);

    // The Wrap Up has to attach "the recorded catalogue listing, destination
    // URLs and the breadcrumb screenshot", so each step keeps what it
    // observed rather than only attaching it in isolation.
    const destinations: string[] = [];
    let catalogueListing: string[] = [];
    let breadcrumbSegments: string[] = [];

    await test.step('Set Up — confirm preconditions, open the store home page', async () => {
      await header.gotoHome();
      destinations.push(`Set Up (home): ${await recordUrl(page, testInfo, 'home page')}`);

      // ENV-01: fresh context per test, so cache and cookies start empty.
      // The TPS also asks to confirm no shopper account is signed in.
      const signedOut = await header.logInLink.isVisible().catch(() => false);

      // Intercase dependency carried from TC-01-002: TP-01-001 must have been
      // executed and its "Catalog" navigation step must have passed. That is
      // a run-order requirement on the suite, not something this procedure
      // can verify from inside itself, so it is declared here and the
      // dependency is re-established below — TC-01-002 #1 navigates via the
      // same "Catalog" control, so a regression in it fails this step too.
      await testInfo.attach('Set Up — preconditions', {
        body: [
          `ENV-01 — "Log In" control visible (i.e. no shopper signed in): ${signedOut}`,
          'Intercase dependency: TP-01-001 must have been executed with its "Catalog"',
          'navigation step passing. Run tp-01-001 before this procedure. TC-01-002 #1',
          'below exercises the same control, so the dependency is re-established',
          'rather than assumed.',
        ].join('\n'),
        contentType: 'text/plain',
      });
      expect(signedOut, 'ENV-01: no shopper account should be signed in at Set Up').toBe(true);
    });

    await test.step('TC-01-002 #1 — Catalog link and product listing', async () => {
      await sidebar.catalogLink.click();
      destinations.push(`Catalog [#1]: ${await recordUrl(page, testInfo, 'Catalog')}`);
      await expect(page).toHaveURL(new RegExp(`${ROUTES.catalog}$`));

      const productNames = await catalog.grid.locator('h3').allTextContents();
      catalogueListing = productNames;
      await testInfo.attach('Catalogue listing at /collections/all', {
        body: productNames.join('\n'),
        contentType: 'text/plain',
      });
      expect(productNames).toContain(PRODUCTS.greyJacket);
    });

    await test.step('TC-01-002 #2 — select Grey jacket', async () => {
      await catalog.productLink(PRODUCTS.greyJacket).click();
      destinations.push(`TD-01-A product page [#2]: ${await recordUrl(page, testInfo, 'Grey jacket PDP')}`);
      await expect(page).toHaveURL(new RegExp(`/products/${PRODUCT_HANDLES.greyJacket}`));
      await expect(product.title).toHaveText(PRODUCTS.greyJacket);
    });

    await test.step('TC-01-002 #3 — breadcrumb trail', async () => {
      const segments = await product.breadcrumbSegments();
      breadcrumbSegments = segments;
      await testInfo.attach('Breadcrumb trail — segments', {
        body: segments.join(' — '),
        contentType: 'text/plain',
      });
      await testInfo.attach('Breadcrumb trail — screenshot', {
        body: await product.breadcrumb.screenshot(),
        contentType: 'image/png',
      });
      expect(segments[0]).toBe('Home');
      expect(segments[segments.length - 1]).toBe(PRODUCTS.greyJacket);
    });

    await test.step('TC-01-002 #4 — follow parent collection, if present', async () => {
      const segments = await product.breadcrumbSegments();
      const hasParentCollectionSegment = segments.length > 2;

      if (hasParentCollectionSegment) {
        // Middle segment(s) sit between "Home" and the product name.
        const parentLink = product.breadcrumb.getByRole('link', { name: segments[1], exact: true });
        await parentLink.click();
        destinations.push(`Parent collection [#4]: ${await recordUrl(page, testInfo, 'Parent collection')}`);
      } else {
        await testInfo.attach('Parent collection — none present', {
          body: `Breadcrumb had no parent-collection segment: ${segments.join(' — ')}`,
          contentType: 'text/plain',
        });
      }
    });

    await test.step('Wrap Up — return to the store home page, attach the recorded results', async () => {
      await header.gotoHome();
      destinations.push(`Wrap Up (home): ${await recordUrl(page, testInfo, 'Wrap Up — store home page')}`);

      // TPS Wrap Up: attach the recorded catalogue listing, destination URLs
      // and the breadcrumb screenshot. The screenshot is attached at
      // TC-01-002 #3; this consolidates the rest into one record so the log
      // entry can be filled from a single attachment.
      await testInfo.attach('TP-01-002 Wrap Up — recorded results', {
        body: [
          'DESTINATION URLs RECORDED',
          ...destinations.map((d) => `  ${d}`),
          '',
          `CATALOGUE LISTING AT /collections/all (${catalogueListing.length} products)`,
          ...(catalogueListing.length ? catalogueListing.map((n) => `  ${n}`) : ['  (none recorded)']),
          '',
          'BREADCRUMB TRAIL AS DISPLAYED',
          `  ${breadcrumbSegments.join(' — ') || '(none recorded)'}`,
          '',
          'The breadcrumb screenshot is attached to step TC-01-002 #3 above.',
        ].join('\n'),
        contentType: 'text/plain',
      });
    });
  });
});
