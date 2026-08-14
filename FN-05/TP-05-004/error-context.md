# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: fn05-checkout\tp-05-004-payment-outcome.spec.ts >> FN-05 Checkout >> TP-05-004 payment outcome
- Location: tests\fn05-checkout\tp-05-004-payment-outcome.spec.ts:32:7

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: ""
Received: "2"
```

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: ""
Received: "12 / 29"
```

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: ""
Received: "123"
```

# Page snapshot

```yaml
- generic [active] [ref=f38e1]:
  - banner [ref=f38e2]:
    - generic [ref=f38e3]:
      - generic [ref=f38e5]:
        - search:
          - button "Submit" [ref=f38e6] [cursor=pointer]
          - textbox "Search" [ref=f38e7]
      - navigation [ref=f38e9]:
        - link "Search" [ref=f38e10] [cursor=pointer]:
          - /url: /search
        - link "About Us" [ref=f38e11] [cursor=pointer]:
          - /url: /pages/about-us
        - link "Log In" [ref=f38e12] [cursor=pointer]:
          - /url: /account/login
        - link "Sign up" [ref=f38e13] [cursor=pointer]:
          - /url: /account/register
      - generic [ref=f38e15]:
        - link "My Cart (0)" [ref=f38e16] [cursor=pointer]:
          - /url: "#"
        - link "Check Out" [ref=f38e17] [cursor=pointer]:
          - /url: /cart
    - generic [ref=f38e20]:
      - heading [level=1] [ref=f38e22]:
        - link [ref=f38e23] [cursor=pointer]:
          - /url: /
          - img "Sauce Demo" [ref=f38e24]
      - heading "Just a demo site showing off what Sauce can do." [level=3] [ref=f38e27]
  - generic [ref=f38e28]:
    - navigation [ref=f38e30]:
      - list [ref=f38e31]:
        - listitem [ref=f38e32]:
          - link "Home" [ref=f38e33] [cursor=pointer]:
            - /url: /
        - listitem [ref=f38e34]:
          - link "Catalog" [ref=f38e35] [cursor=pointer]:
            - /url: /collections/all
        - listitem [ref=f38e36]:
          - link "Blog" [ref=f38e37] [cursor=pointer]:
            - /url: /blogs/news
        - listitem [ref=f38e38]:
          - link "About Us" [ref=f38e39] [cursor=pointer]:
            - /url: /pages/about-us
        - listitem [ref=f38e40]:
          - link "Wish list" [ref=f38e41] [cursor=pointer]:
            - /url: "#sauce-show-wish-list"
        - listitem [ref=f38e42]:
          - link "Refer a friend" [ref=f38e43] [cursor=pointer]:
            - /url: "#sauce-show-refer-friend"
      - generic [ref=f38e44]:
        - link [ref=f38e45] [cursor=pointer]:
          - /url: http://www.facebook.com/shopify
        - link [ref=f38e46] [cursor=pointer]:
          - /url: http://www.twitter.com/sauce_io
        - link [ref=f38e47] [cursor=pointer]:
          - /url: http://www.instagram.com/shopify
        - link [ref=f38e48] [cursor=pointer]:
          - /url: http://www.pinterest.com/chrisjhoughton/awesome-facebook-integration/
        - link [ref=f38e49] [cursor=pointer]:
          - /url: /blogs/news.atom
    - generic [ref=f38e51]:
      - generic [ref=f38e52]:
        - link "Home" [ref=f38e54] [cursor=pointer]:
          - /url: /
        - text: —
        - link "Cart" [ref=f38e55] [cursor=pointer]:
          - /url: /cart
      - heading "My Cart" [level=1] [ref=f38e56]
      - paragraph [ref=f38e58]:
        - text: It appears that your cart is currently empty!
        - link "Continue Shopping" [ref=f38e59] [cursor=pointer]:
          - /url: /collections/all
        - text: .
    - contentinfo [ref=f38e60]:
      - generic [ref=f38e61]:
        - navigation [ref=f38e63]:
          - heading "Footer" [level=2] [ref=f38e64]
          - link "Search" [ref=f38e65] [cursor=pointer]:
            - /url: /search
          - link "About Us" [ref=f38e66] [cursor=pointer]:
            - /url: /pages/about-us
        - generic [ref=f38e68]:
          - heading "About Us" [level=2] [ref=f38e69]
          - paragraph [ref=f38e71]:
            - strong [ref=f38e72]:
              - text: This is a demo site created for
              - link "Sauce" [ref=f38e73] [cursor=pointer]:
                - /url: http://sauceapp.io
            - text: ", an awesome new way to make your Shopify site social. Sauce allows you to let customers to share what they purchase to their friends, and see what their friends have purchased or \"wanted\" on your store."
        - generic [ref=f38e75]:
          - img "We accept Amex" [ref=f38e76]
          - img "We accept Visa" [ref=f38e77]
          - img "We accept Mastercard" [ref=f38e78]
      - generic [ref=f38e79]:
        - generic [ref=f38e81]:
          - text: Copyright © 2026 Sauce Demo.
          - link "Shopping Cart by Shopify" [ref=f38e82] [cursor=pointer]:
            - /url: https://www.shopify.co.uk/tour/shopping-cart?utm_campaign=poweredby&utm_medium=shopify&utm_source=onlinestore
          - text: .
        - navigation [ref=f38e84]:
          - link "Search" [ref=f38e85] [cursor=pointer]:
            - /url: /search
          - link "About Us" [ref=f38e86] [cursor=pointer]:
            - /url: /pages/about-us
```

# Test source

```ts
  1   | import { test, expect } from '../../utils/pacedTest';
  2   | import { CartPage } from '../../pages/CartPage';
  3   | import { ConfirmationPage } from '../../pages/ConfirmationPage';
  4   | import {
  5   |   addProductAndGoToCheckout,
  6   |   fillDeliveryAddress,
  7   |   fillCard,
  8   |   TEST_CARDS,
  9   |   NAME_ON_CARD,
  10  |   SIMULATION_VALUES,
  11  |   recordSimulationValue,
  12  |   recordMessages,
  13  | } from './_helpers';
  14  | import { GUEST_CONTACT } from '../../fixtures/credentials';
  15  | import { recordUrl, withFailureEvidence } from '../../utils/evidence';
  16  | 
  17  | /**
  18  |  * TP-05-004 — Verify a declined payment does not complete the order,
  19  |  * shows an error and clears the payment fields, and that a gateway
  20  |  * failure likewise does not complete the order while an approved
  21  |  * payment does. Covers TC-05-014, TC-05-007 (merged per the refined
  22  |  * TPS FN-05, replacing the old separate TP-05-014/TP-05-007).
  23  |  *
  24  |  * TC-05-014 is executed first (it completes nothing), so the single
  25  |  * order this procedure completes lands at the very end, per the
  26  |  * document's own note: "no order is left in the store partway through."
  27  |  *
  28  |  * Must run before TP-05-005 — TC-05-008 declares TC-05-007 as its
  29  |  * prerequisite.
  30  |  */
  31  | test.describe('FN-05 Checkout', () => {
  32  |   test('TP-05-004 payment outcome', async ({ page }, testInfo) => {
  33  |     test.setTimeout(120_000);
  34  | 
  35  |     const { checkout } = await addProductAndGoToCheckout(page);
  36  |     const confirmation = new ConfirmationPage(page);
  37  |     await fillDeliveryAddress(page, checkout, 'United Kingdom');
  38  | 
  39  |     await test.step('TC-05-014 #1 — Payment section displays card number, expiry, CVV, name fields', async () => {
  40  |       await expect(checkout.cardField('Card number')).toBeVisible();
  41  |       await expect(checkout.cardField('Expiration date (MM / YY)')).toBeVisible();
  42  |       await expect(checkout.cardField('Security code')).toBeVisible();
  43  |       await expect(checkout.cardField('Name on card')).toBeVisible();
  44  |     });
  45  | 
  46  |     await withFailureEvidence(page, testInfo, 'TC-05-014 #2 declined payment does not complete', async () => {
  47  |       await test.step('TC-05-014 #2 — declined-payment simulation value does not complete the order', async () => {
  48  |         await fillCard(checkout, TEST_CARDS.declined, '12/29', '123', NAME_ON_CARD);
  49  |         await recordSimulationValue(testInfo, 'TC-05-014 #2', SIMULATION_VALUES.declined);
  50  |         await checkout.payNowButton.click();
  51  |         await page.waitForTimeout(3000);
  52  |         const url = await recordUrl(page, testInfo, 'After declined payment (TC-05-014)');
  53  |         // The Wrap Up requires the error message displayed for the
  54  |         // declined outcome, and SPR-23 requires which messages were shown
  55  |         // and which were not.
  56  |         await recordMessages(page, testInfo, 'TC-05-014 #2 declined payment', [
  57  |           'declined',
  58  |           'gateway',
  59  |           'expired',
  60  |           'security code',
  61  |         ]);
  62  |         expect(url).toContain('/checkouts/');
  63  |       });
  64  |     });
  65  | 
  66  |     await test.step('TC-05-014 #3 — payment fields are cleared for re-entry after the error', async () => {
  67  |       const cardValue = await checkout.cardField('Card number').inputValue().catch(() => null);
  68  |       const expiryValue = await checkout.cardField('Expiration date (MM / YY)').inputValue().catch(() => null);
  69  |       const cvvValue = await checkout.cardField('Security code').inputValue().catch(() => null);
  70  |       await testInfo.attach('Payment field values after declined payment (TC-05-014)', {
  71  |         body: `card number: "${cardValue}"\nexpiry: "${expiryValue}"\nCVV: "${cvvValue}"`,
  72  |         contentType: 'text/plain',
  73  |       });
  74  | 
  75  |       expect.soft(cardValue ?? '').toBe('');
  76  |       expect.soft(expiryValue ?? '').toBe('');
> 77  |       expect.soft(cvvValue ?? '').toBe('');
      |                                   ^ Error: expect(received).toBe(expected) // Object.is equality
  78  |     });
  79  | 
  80  |     await test.step('Reset — return to store, empty cart, re-add product before TC-05-007', async () => {
  81  |       await page.goto('/', { waitUntil: 'domcontentloaded' });
  82  |       const cart = new CartPage(page);
  83  |       await cart.goto();
  84  |       const remaining = await cart.lineCount();
  85  |       for (let i = remaining - 1; i >= 0; i--) {
  86  |         await cart.removeLine(i).click();
  87  |       }
  88  |     });
  89  | 
  90  |     const tc007 = await addProductAndGoToCheckout(page);
  91  |     // TD-05-E. The contact address is required to complete a guest order at
  92  |     // all, and SPR-18 requires it recorded alongside the confirmation
  93  |     // number so orders raised by testing can be identified afterwards.
  94  |     const guestEmail = GUEST_CONTACT.email();
  95  |     await tc007.checkout.emailField.fill(guestEmail);
  96  |     await fillDeliveryAddress(page, tc007.checkout, 'United Kingdom');
  97  | 
  98  |     await withFailureEvidence(page, testInfo, 'TC-05-007 #1 declined payment', async () => {
  99  |       await test.step('TC-05-007 #1 — declined-payment simulation value does not complete the order', async () => {
  100 |         await fillCard(tc007.checkout, TEST_CARDS.declined, '12/29', '123', NAME_ON_CARD);
  101 |         await recordSimulationValue(testInfo, 'TC-05-007 #1', SIMULATION_VALUES.declined);
  102 |         await tc007.checkout.payNowButton.click();
  103 |         await page.waitForTimeout(3000);
  104 |         const url = await recordUrl(page, testInfo, 'After declined payment (TC-05-007)');
  105 |         await recordMessages(page, testInfo, 'TC-05-007 #1 declined payment', [
  106 |           'declined',
  107 |           'gateway',
  108 |           'expired',
  109 |           'security code',
  110 |         ]);
  111 |         expect(url).toContain('/checkouts/');
  112 |       });
  113 |     });
  114 | 
  115 |     await withFailureEvidence(page, testInfo, 'TC-05-007 #2 gateway failure', async () => {
  116 |       await test.step('TC-05-007 #2 — gateway-failure simulation value does not complete the order', async () => {
  117 |         await fillCard(tc007.checkout, TEST_CARDS.gatewayFailure, '12/29', '123', NAME_ON_CARD);
  118 |         await recordSimulationValue(testInfo, 'TC-05-007 #2', SIMULATION_VALUES.gatewayFailure);
  119 |         await tc007.checkout.payNowButton.click();
  120 |         await page.waitForTimeout(3000);
  121 |         const url = await recordUrl(page, testInfo, 'After gateway failure');
  122 |         await recordMessages(page, testInfo, 'TC-05-007 #2 gateway failure', [
  123 |           'gateway',
  124 |           'declined',
  125 |           'try again',
  126 |           'security code',
  127 |         ]);
  128 |         expect(url).toContain('/checkouts/');
  129 |       });
  130 |     });
  131 | 
  132 |     await withFailureEvidence(page, testInfo, 'TC-05-007 #3 approved payment', async () => {
  133 |       await test.step('TC-05-007 #3 — approved-payment simulation value completes the order', async () => {
  134 |         await fillCard(tc007.checkout, TEST_CARDS.approved, '12/29', '123', NAME_ON_CARD);
  135 |         await recordSimulationValue(testInfo, 'TC-05-007 #3', SIMULATION_VALUES.approved);
  136 |         await tc007.checkout.payNowButton.click();
  137 |         await page.waitForURL(/\/(thank[_-]?you|orders)/i, { timeout: 20000 }).catch(() => {});
  138 |         await recordUrl(page, testInfo, 'After approved payment');
  139 | 
  140 |         await expect(confirmation.thankYouHeading).toBeVisible();
  141 |         await expect(confirmation.confirmationNumber).toBeVisible();
  142 |         const confirmationText = await confirmation.confirmationNumber.textContent();
  143 |         // SPR-18: the confirmation number AND the contact address used, so
  144 |         // this order can be identified on the live store afterwards.
  145 |         await testInfo.attach('Confirmation number and contact address (TC-05-007)', {
  146 |           body: `confirmation: ${confirmationText ?? '(not found)'}\ncontact address: ${guestEmail}`,
  147 |           contentType: 'text/plain',
  148 |         });
  149 |         // The Wrap Up requires the confirmation page summary: items,
  150 |         // shipping method, shipping address, billing address, payment method.
  151 |         await testInfo.attach('Confirmation page summary (TC-05-007)', {
  152 |           body: (await page.locator('main').innerText().catch(() => '')) || '(summary not readable)',
  153 |           contentType: 'text/plain',
  154 |         });
  155 |         await testInfo.attach('Confirmation page — screenshot (TC-05-007)', {
  156 |           body: await page.screenshot({ fullPage: true }),
  157 |           contentType: 'image/png',
  158 |         });
  159 |       });
  160 |     });
  161 | 
  162 |     await test.step('Wrap Up — return to store home page, confirm cart empty following order completion', async () => {
  163 |       await page.goto('/', { waitUntil: 'domcontentloaded' });
  164 |       const cart = new CartPage(page);
  165 |       await cart.goto();
  166 |       expect(await cart.lineCount()).toBe(0);
  167 |     });
  168 |   });
  169 | });
  170 | 
```