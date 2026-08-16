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
  /** TD-03-F — whitespace-only value. */
  whitespaceOnly: ' ',
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

/**
 * FN-07 (Authentication) bound test data, TPS Table 2.7a.
 *
 * These live here rather than in .env, unlike TEST_ACCOUNT, because every
 * value below is printed in the TPS — a shared controlled document — so
 * none of them is a secret. The one FN-07 value that IS unpublished is
 * TD-07-ACC's original password, which stays in .env as
 * TEST_ACCOUNT_PASSWORD (see fixtures/credentials.ts). TD-07-ACC's address
 * is also already wired to .env as TEST_ACCOUNT_EMAIL and used by FN-02
 * through FN-06, so it is read from there rather than duplicated here.
 *
 * CONSUMED ON USE: n1, n2 and n3 register successfully and cannot be
 * reused. A later cycle rebinds them by advancing the sequence number
 * (+auth1a becomes +auth2a and so on) — change the values here only, since
 * the specs refer to the identifier. nx must NEVER be used in a step that
 * succeeds: TC-07-017 needs it as the unregistered comparator at password
 * recovery, and a successful registration would destroy that.
 *
 * All addresses resolve to one mailbox by subaddressing, which the store
 * treats as distinct addresses. Confirm that still holds before each cycle
 * (A-004) and rebind using dot variants of the same mailbox if it stops.
 */
export const AUTH_TEST_DATA = {
  /** TD-07-N1 — minimum-length password registration. Consumed on use. */
  n1: 'competitiontdc2.0+auth1a@gmail.com',
  /** TD-07-N2 — above-minimum password registration. Consumed on use. */
  n2: 'competitiontdc2.0+auth1b@gmail.com',
  /** TD-07-N3 — mid-partition password registration. Consumed on use. */
  n3: 'competitiontdc2.0+auth1c@gmail.com',
  /** TD-07-N4 — successful registration that sends a confirmation email. Consumed on use. */
  n4: 'competitiontdc2.0+auth1d@gmail.com',
  /** TD-07-NX — every attempt expected to be BLOCKED, plus TC-07-017's comparator. Never consumed. */
  nx: 'competitiontdc2.0+authx@gmail.com',

  /** TD-07-NAME — name values entered on the registration form. */
  name: { firstName: 'Kelvin', lastName: 'Kan' },

  /** TD-07-PW — carrier password, wherever the password is not the value under test. */
  password: 'Password123',
  /** TD-07-PWTMP — replacement password set by TP-07-005 (TC-07-013 #9). */
  passwordTemp: 'TempPassword123',
  /** TD-07-PWNEW — replacement password set by TP-07-006 (TC-07-016 #4). */
  passwordNew: 'NewPassword123',
  /** TD-07-BADEMAIL — structurally invalid, not a deliverable address. */
  badEmail: 'kelvin@@example',
  /** TD-07-BADPW — matches no account, used to reach the invalid credentials rule. */
  badPassword: 'WrongPassword123',

  /**
   * Password length values stated literally by TC-07-001 to TC-07-003,
   * where the length IS the variable rather than a carrier. Five and six
   * are the boundaries; eight is the mid-partition value; four is the
   * boundary immediately below the minimum.
   */
  passwords: {
    atMinimum: 'abcde',
    aboveMinimum: 'abcdef',
    midPartition: 'P@ssw0rd',
    belowMinimum: 'abcd',
    belowMinimumOtherClass: '1234',
    whitespaceOnly: '     ',
  },
} as const;
