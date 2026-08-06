import { Page, Locator } from '@playwright/test';

/**
 * /products/{handle} — product detail page.
 *
 * Sold-out state is confirmed (via Brown Shades, an actually sold-out
 * product) to NOT be a separate badge here, unlike the catalogue grid's
 * .sold-out div. #add just changes value to "Sold Out" and gets disabled
 * and class="disabled". TC-02-001's "Sold Out badge" check should be read
 * against this button state — there is no other visual badge on the PDP.
 */
export class ProductPage {
  readonly page: Page;
  readonly breadcrumb: Locator;
  readonly title: Locator;
  readonly price: Locator;
  readonly description: Locator;
  readonly sizeSelect: Locator;
  readonly colourSelect: Locator;
  readonly addToCartButton: Locator;
  readonly galleryImage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.breadcrumb = page.locator('#breadcrumb');
    this.title = page.locator('h1[itemprop="name"]');
    this.price = page.locator('#product-price .product-price');
    this.description = page.locator('[itemprop="description"]');
    this.sizeSelect = page.locator('#product-select-option-0');
    this.colourSelect = page.locator('#product-select-option-1');
    this.addToCartButton = page.locator('#add');
    this.galleryImage = page.locator('#feature-image');
  }

  async goto(handle: string) {
    await this.page.goto(`/products/${handle}`, { waitUntil: 'domcontentloaded' });
  }

  async selectSize(value: string) {
    await this.sizeSelect.selectOption(value);
  }

  async selectColour(value: string) {
    await this.colourSelect.selectOption(value);
  }

  async isAddToCartDisabled(): Promise<boolean> {
    return this.addToCartButton.isDisabled();
  }

  /** #add is an <input type="submit">, so its label is the value attribute, not text content. */
  async addToCartLabel(): Promise<string> {
    return this.addToCartButton.inputValue();
  }

  async breadcrumbSegments(): Promise<string[]> {
    const text = await this.breadcrumb.innerText();
    return text.split('—').map((s) => s.trim()).filter(Boolean);
  }
}
