/**
 * Baseline catalogue per TCS 2.1.3.
 *
 * IMPORTANT: the live store renders these names in sentence case
 * ("Grey jacket"), not title case ("Grey Jacket") as written in the TCS.
 * Use these constants everywhere rather than typing the name into a test,
 * and raise the casing difference with the Test Designers — A-004 says
 * store content can change, so the document may simply be out of date.
 */
export const PRODUCTS = {
  greyJacket: 'Grey jacket',
  noirJacket: 'Noir jacket',
  stripedTop: 'Striped top',
  blackHeels: 'Black heels',
  bronzeSandals: 'Bronze sandals',
  brownShades: 'Brown shades',
  whiteSandals: 'White sandals',
} as const;

/** Confirmed URLs observed on the live store, for destination assertions. */
export const ROUTES = {
  home: '/',
  catalog: '/collections/all',
  blog: '/blogs/news',
  aboutUs: '/pages/about-us',
  search: '/search',
  cart: '/cart',
  login: '/account/login',
  register: '/account/register',
} as const;

/**
 * Product handles confirmed from the catalogue page and Shopify analytics
 * payload — the URL slug does not match the display name (e.g. "Black
 * heels" lives at /products/flower-print-jeans), so tests must locate
 * catalogue tiles by name (see CatalogPage.productLink), not by guessing
 * the handle from PRODUCTS.
 */
export const PRODUCT_HANDLES = {
  blackHeels: 'flower-print-jeans',
  bronzeSandals: 'bronze-sandals',
  brownShades: 'brown-shades',
  greyJacket: 'grey-jacket',
  noirJacket: 'noir-jacket',
  stripedTop: 'striped-top',
  whiteSandals: 'white-sandals',
} as const;

/**
 * Confirmed on the live store (product options JSON): only Noir jacket
 * offers more than one colour (Blue/Red across S/M/L). Black heels only
 * has one colour (Red), so it cannot stand in for ENV-07's multi-variant
 * requirement — TP-02-002/004/005 must use Noir jacket.
 */
export const VARIANTS = {
  noirJacket: { sizes: ['S', 'M', 'L'], colours: ['Blue', 'Red'] },
} as const;

/** Search terms per TCS 2.3.3, confirmed against the baseline catalogue. */
export const SEARCH_TERMS = {
  exactMatch: 'Grey Jacket',
  partialKeyword: 'jacket',
  metadataMatch: 'glasses',
  noMatch: 'backpack',
  specialCharsOnly: '@#$%',
  headerFooterControlCheck: 'sandals',
} as const;

/**
 * TD-04-* bindings from the refined TPS FN-04's Table 2.4a — kept as one
 * named block so a rebind touches this file, not every FN-04 procedure.
 * TD-04-V1/V2 read against VARIANTS.noirJacket above.
 */
export const CART_TEST_DATA = {
  /** TD-04-A — Product A, the single-line test product. */
  productA: PRODUCTS.stripedTop,
  productAHandle: PRODUCT_HANDLES.stripedTop,
  /** TD-04-B — Product B, distinct from Product A. */
  productB: PRODUCTS.greyJacket,
  productBHandle: PRODUCT_HANDLES.greyJacket,
  /** TD-04-V — the multi-variant product (ENV-07). */
  productV: PRODUCTS.noirJacket,
  productVHandle: PRODUCT_HANDLES.noirJacket,
  /** TD-04-V1 — first variant selection on TD-04-V. */
  variant1: { size: 'M', colour: 'Blue' },
  /** TD-04-V2 — second variant selection on TD-04-V, distinct from V1. */
  variant2: { size: 'S', colour: 'Red' },
  /** TD-04-N — order note text. */
  orderNote: 'Please deliver after 6pm',
  /**
   * TD-04-S — assumed available stock level. DEF-F4-05 confirms no real
   * stock count is ever displayed or enforced, so this is carried as an
   * assumption per the TPS's own note, not read from the page.
   */
  assumedStock: 10,
} as const;

export const EXTERNAL_DESTINATIONS = {
  facebook: 'facebook.com',
  twitter: 'twitter.com',
  instagram: 'instagram.com',
  pinterest: 'pinterest.com',
  shopify: 'shopify.co',
} as const;
