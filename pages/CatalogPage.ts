import { Page, Locator } from '@playwright/test';

/**
 * /collections/all — product grid and breadcrumb.
 * Each tile is <a href="/collections/all/products/{handle}"><img alt="{name}">
 * <h3>{name}</h3><h4>{price}</h4></a>, with an optional sibling
 * <div class="sold-out">Sold Out</div>. The href handle does not match the
 * display name (e.g. "Black heels" -> /products/flower-print-jeans), so
 * tiles are located by their <h3> text, not the URL.
 */
export class CatalogPage {
  readonly page: Page;
  readonly grid: Locator;
  readonly breadcrumb: Locator;

  constructor(page: Page) {
    this.page = page;
    this.grid = page.locator('.product-grid');
    this.breadcrumb = page.locator('#breadcrumb');
  }

  async goto() {
    await this.page.goto('/collections/all');
  }

  productLink(name: string): Locator {
    return this.grid.locator('a').filter({ has: this.page.locator('h3', { hasText: new RegExp(`^${name}$`) }) });
  }

  soldOutBadge(name: string): Locator {
    return this.productLink(name).locator('.sold-out');
  }

  /** Splits the em-dash-separated breadcrumb into trimmed segments, e.g. ["Home", "Products"]. */
  async breadcrumbSegments(): Promise<string[]> {
    const text = await this.breadcrumb.innerText();
    return text.split('—').map((s) => s.trim()).filter(Boolean);
  }
}
