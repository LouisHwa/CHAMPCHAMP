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

export const EXTERNAL_DESTINATIONS = {
  facebook: 'facebook.com',
  twitter: 'twitter.com',
  instagram: 'instagram.com',
  pinterest: 'pinterest.com',
  shopify: 'shopify.co',
} as const;

/**
 * FN-06 (Account and Address Management) bound test data, TPS Table 2.6a.
 *
 * TD-06-UK's field values are not bound by the TPS ("remaining fields to be
 * recorded before execution") — plausible, format-valid UK values are used
 * here. Its own premise ("a country that does not use subdivisions") does
 * NOT hold on this store: live capture (9 Aug) confirmed United Kingdom
 * carries subdivision data (England/Northern Ireland/Scotland/Wales/
 * British Forces) same as Malaysia — see AddressBookPage.ts's header
 * comment and tp-06-002's TC-06-002 #5 step, which asserts the opposite of
 * the TPS's literal wording for that reason.
 */
export const ACCOUNT_TEST_DATA = {
  malaysiaAddress: {
    country: 'Malaysia',
    province: 'Selangor',
    address1: 'No. 5, Jalan Universiti',
    address2: 'Bandar Sunway',
    city: 'Subang Jaya',
    company: 'Sunway University',
    zip: '47500',
    phone: '+60 3-7491 8622',
  },
  ukAddress: {
    country: 'United Kingdom',
    address1: '10 Downing Street',
    city: 'London',
    zip: 'EC2A 4BX',
  },
  name: { firstName: 'John', lastName: 'Doe' },
  /** Postcode well-formed for another country but not for Malaysia. */
  malformedMalaysiaZip: 'SW1A 1AA',
  /** Phone containing alphabetic characters. */
  phoneWithLetters: 'asdf',
  /** Phone containing disallowed symbols. */
  phoneWithSymbols: '@#$%',
  wishlistItem1: PRODUCTS.greyJacket,
  wishlistItem2: PRODUCTS.stripedTop,
} as const;
