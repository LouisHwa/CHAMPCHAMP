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

    await test.step('Set Up — open the store home page', async () => {
      await header.gotoHome();
    });

    await test.step('TC-01-002 #1 — Catalog link and product listing', async () => {
      await sidebar.catalogLink.click();
      await recordUrl(page, testInfo, 'Catalog');
      await expect(page).toHaveURL(new RegExp(`${ROUTES.catalog}$`));

      const productNames = await catalog.grid.locator('h3').allTextContents();
      await testInfo.attach('Catalogue listing at /collections/all', {
        body: productNames.join('\n'),
        contentType: 'text/plain',
      });
      expect(productNames).toContain(PRODUCTS.greyJacket);
    });

    await test.step('TC-01-002 #2 — select Grey jacket', async () => {
      await catalog.productLink(PRODUCTS.greyJacket).click();
      await recordUrl(page, testInfo, 'Grey jacket PDP');
      await expect(page).toHaveURL(new RegExp(`/products/${PRODUCT_HANDLES.greyJacket}`));
      await expect(product.title).toHaveText(PRODUCTS.greyJacket);
    });

    await test.step('TC-01-002 #3 — breadcrumb trail', async () => {
      const segments = await product.breadcrumbSegments();
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
        await recordUrl(page, testInfo, 'Parent collection');
      } else {
        await testInfo.attach('Parent collection — none present', {
          body: `Breadcrumb had no parent-collection segment: ${segments.join(' — ')}`,
          contentType: 'text/plain',
        });
      }
    });

    await test.step('Wrap Up — return to the store home page', async () => {
      await header.gotoHome();
    });
  });
});
