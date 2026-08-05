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
  greyJacketPdp: '/collections/frontpage/products/grey-jacket',
} as const;

export const EXTERNAL_DESTINATIONS = {
  facebook: 'facebook.com',
  twitter: 'twitter.com',
  instagram: 'instagram.com',
  pinterest: 'pinterest.com',
  shopify: 'shopify.co',
} as const;
