# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: fn05-checkout\tp-05-003-payment-field-validation.spec.ts >> FN-05 Checkout >> TP-05-003 payment field validation
- Location: tests\fn05-checkout\tp-05-003-payment-field-validation.spec.ts:67:7

# Error details

```
Error: TC-05-003 #2 — 12-digit (below min): TPS expects this card number to be rejected at entry

expect(received).toBe(expected) // Object.is equality

Expected: false
Received: true
```

```
Error: TC-05-003 #6 — 20-digit (above max): TPS requires a genuine refusal here — the field capping the value on entry is explicitly not the expected result

expect(received).toBe(expected) // Object.is equality

Expected: false
Received: true
```

```
Error: TC-05-003 #7 — 11-digit (well below range): TPS expects this card number to be rejected at entry

expect(received).toBe(expected) // Object.is equality

Expected: false
Received: true
```

```
Error: TC-05-003 #8 — 22-digit (well above range): TPS requires a genuine refusal here — the field capping the value on entry is explicitly not the expected result

expect(received).toBe(expected) // Object.is equality

Expected: false
Received: true
```

```
Error: TC-05-004 #3: TPS expects a Luhn-invalid number to be rejected at entry

expect(received).toBe(expected) // Object.is equality

Expected: false
Received: true
```

```
Error: TC-05-005 #6 — 5-digit (above max): TPS requires a genuine refusal here — the field capping the value on entry is explicitly not the expected result

expect(received).toBe(expected) // Object.is equality

Expected: false
Received: true
```

```
Error: TC-05-005 #7 — 7-digit (well above max): TPS requires a genuine refusal here — the field capping the value on entry is explicitly not the expected result

expect(received).toBe(expected) // Object.is equality

Expected: false
Received: true
```

```
Error: TC-05-006 #3 — 1 month before current (expired): TPS expects this expiry date to be rejected at entry

expect(received).toBe(expected) // Object.is equality

Expected: false
Received: true
```

```
Error: TC-05-006 #6 — past date 01/20: TPS expects this expiry date to be rejected at entry

expect(received).toBe(expected) // Object.is equality

Expected: false
Received: true
```

```
Error: TC-05-006 #7 — non-calendar month 13/27: TPS expects this expiry date to be rejected at entry

expect(received).toBe(expected) // Object.is equality

Expected: false
Received: true
```

# Page snapshot

```yaml
- generic [active] [ref=f27e1]:
  - banner [ref=f27e2]:
    - generic [ref=f27e3]:
      - generic [ref=f27e5]:
        - search:
          - button "Submit" [ref=f27e6] [cursor=pointer]
          - textbox "Search" [ref=f27e7]
      - navigation [ref=f27e9]:
        - link "Search" [ref=f27e10] [cursor=pointer]:
          - /url: /search
        - link "About Us" [ref=f27e11] [cursor=pointer]:
          - /url: /pages/about-us
        - link "Log In" [ref=f27e12] [cursor=pointer]:
          - /url: /account/login
        - link "Sign up" [ref=f27e13] [cursor=pointer]:
          - /url: /account/register
      - generic [ref=f27e15]:
        - link "My Cart (0)" [ref=f27e16] [cursor=pointer]:
          - /url: "#"
        - link "Check Out" [ref=f27e17] [cursor=pointer]:
          - /url: /cart
    - generic [ref=f27e20]:
      - heading [level=1] [ref=f27e22]:
        - link [ref=f27e23] [cursor=pointer]:
          - /url: /
          - img "Sauce Demo" [ref=f27e24]
      - heading "Just a demo site showing off what Sauce can do." [level=3] [ref=f27e27]
  - generic [ref=f27e28]:
    - navigation [ref=f27e30]:
      - list [ref=f27e31]:
        - listitem [ref=f27e32]:
          - link "Home" [ref=f27e33] [cursor=pointer]:
            - /url: /
        - listitem [ref=f27e34]:
          - link "Catalog" [ref=f27e35] [cursor=pointer]:
            - /url: /collections/all
        - listitem [ref=f27e36]:
          - link "Blog" [ref=f27e37] [cursor=pointer]:
            - /url: /blogs/news
        - listitem [ref=f27e38]:
          - link "About Us" [ref=f27e39] [cursor=pointer]:
            - /url: /pages/about-us
        - listitem [ref=f27e40]:
          - link "Wish list" [ref=f27e41] [cursor=pointer]:
            - /url: "#sauce-show-wish-list"
        - listitem [ref=f27e42]:
          - link "Refer a friend" [ref=f27e43] [cursor=pointer]:
            - /url: "#sauce-show-refer-friend"
      - generic [ref=f27e44]:
        - link [ref=f27e45] [cursor=pointer]:
          - /url: http://www.facebook.com/shopify
        - link [ref=f27e46] [cursor=pointer]:
          - /url: http://www.twitter.com/sauce_io
        - link [ref=f27e47] [cursor=pointer]:
          - /url: http://www.instagram.com/shopify
        - link [ref=f27e48] [cursor=pointer]:
          - /url: http://www.pinterest.com/chrisjhoughton/awesome-facebook-integration/
        - link [ref=f27e49] [cursor=pointer]:
          - /url: /blogs/news.atom
    - generic [ref=f27e52]:
      - link [ref=f27e54] [cursor=pointer]:
        - /url: /collections/frontpage/products/grey-jacket
        - img "Grey jacket" [ref=f27e55]
        - heading "Grey jacket" [level=3] [ref=f27e56]
        - heading "£55.00" [level=4] [ref=f27e57]
      - link [ref=f27e59] [cursor=pointer]:
        - /url: /collections/frontpage/products/noir-jacket
        - img "Noir jacket" [ref=f27e60]
        - heading "Noir jacket" [level=3] [ref=f27e61]
        - heading "£60.00" [level=4] [ref=f27e62]
      - link [ref=f27e64] [cursor=pointer]:
        - /url: /collections/frontpage/products/striped-top
        - img "Striped top" [ref=f27e65]
        - heading "Striped top" [level=3] [ref=f27e66]
        - heading "£50.00" [level=4] [ref=f27e67]
    - contentinfo [ref=f27e68]:
      - generic [ref=f27e69]:
        - navigation [ref=f27e71]:
          - heading "Footer" [level=2] [ref=f27e72]
          - link "Search" [ref=f27e73] [cursor=pointer]:
            - /url: /search
          - link "About Us" [ref=f27e74] [cursor=pointer]:
            - /url: /pages/about-us
        - generic [ref=f27e76]:
          - heading "About Us" [level=2] [ref=f27e77]
          - paragraph [ref=f27e79]:
            - strong [ref=f27e80]:
              - text: This is a demo site created for
              - link "Sauce" [ref=f27e81] [cursor=pointer]:
                - /url: http://sauceapp.io
            - text: ", an awesome new way to make your Shopify site social. Sauce allows you to let customers to share what they purchase to their friends, and see what their friends have purchased or \"wanted\" on your store."
        - generic [ref=f27e83]:
          - img "We accept Amex" [ref=f27e84]
          - img "We accept Visa" [ref=f27e85]
          - img "We accept Mastercard" [ref=f27e86]
      - generic [ref=f27e87]:
        - generic [ref=f27e89]:
          - text: Copyright © 2026 Sauce Demo.
          - link "Shopping Cart by Shopify" [ref=f27e90] [cursor=pointer]:
            - /url: https://www.shopify.co.uk/tour/shopping-cart?utm_campaign=poweredby&utm_medium=shopify&utm_source=onlinestore
          - text: .
        - navigation [ref=f27e92]:
          - link "Search" [ref=f27e93] [cursor=pointer]:
            - /url: /search
          - link "About Us" [ref=f27e94] [cursor=pointer]:
            - /url: /pages/about-us
```

# Test source

```ts
  228 |       { label: 'TC-05-005 #3 — 2-digit (below min)', candidate: '12', shouldAccept: false },
  229 |       { label: 'TC-05-005 #4 — 3-digit (at min)', candidate: '123', shouldAccept: true },
  230 |       { label: 'TC-05-005 #6 — 5-digit (above max)', candidate: '12345', shouldAccept: false },
  231 |       { label: 'TC-05-005 #7 — 7-digit (well above max)', candidate: '1234567', shouldAccept: false },
  232 |     ];
  233 | 
  234 |     for (const c of cvvCases) {
  235 |       await test.step(c.label, async () => {
  236 |         const value = await cvvReadback(cvvField, c.candidate);
  237 |         const truncated = value.length < c.candidate.length;
  238 |         const accepted = value.length >= 3 && value.length <= 4 && !truncated;
  239 |         // Same three-way outcome as the card number cases above.
  240 |         const outcome = accepted
  241 |           ? 'ACCEPTED'
  242 |           : truncated
  243 |             ? 'TRUNCATED ON ENTRY — field capped the value; NOT a refusal'
  244 |             : 'REFUSED — value retained in full but rejected';
  245 |         await testInfo.attach(`${c.label} — readback`, {
  246 |           body: `entered: "${c.candidate}"\nreadback: "${value}"\noutcome: ${outcome}\nexpected accept: ${c.shouldAccept}`,
  247 |           contentType: 'text/plain',
  248 |         });
  249 |         await recordFieldContents(testInfo, c.label, c.candidate, value);
  250 |         await recordMessages(page, testInfo, c.label, [
  251 |           'Enter a security code',
  252 |           'Security code is not valid',
  253 |           'too short',
  254 |           'too long',
  255 |         ]);
  256 |         // Soft: same reasoning as the card-number cases — one rejected
  257 |         // partition must not abort the rest of the equivalence set.
  258 |         expect.soft(accepted, `${c.label}: TPS expects this security code to be ${c.shouldAccept ? 'accepted' : 'rejected'} at entry`).toBe(c.shouldAccept);
  259 |         if (!c.shouldAccept && c.candidate.length > 0) {
  260 |           // The empty case is excluded: there is nothing to truncate there.
  261 |           expect.soft(truncated, `${c.label}: TPS requires a genuine refusal here — the field capping the value on entry is explicitly not the expected result`).toBe(false);
  262 |         }
  263 |       });
  264 |     }
  265 | 
  266 |     await test.step('TC-05-005 #5 — Amex card accepts a 4-digit security code', async () => {
  267 |       await cardField.fill('');
  268 |       await cardField.fill('370000000000002');
  269 |       const value = await cvvReadback(cvvField, '1234');
  270 |       await testInfo.attach('Amex 4-digit CVV readback', {
  271 |         body: `readback: "${value}"`,
  272 |         contentType: 'text/plain',
  273 |       });
  274 |       expect(value.length).toBe(4);
  275 |     });
  276 | 
  277 |     const expiryField = checkout.cardField('Expiration date (MM / YY)');
  278 | 
  279 |     await test.step('TC-05-006 #1 — valid card number, Payment section displays expiry date field', async () => {
  280 |       await cardField.fill('');
  281 |       await cardField.fill('4111111111111111');
  282 |       await expect(expiryField).toBeVisible();
  283 |     });
  284 | 
  285 |     const currentBoundary = monthYear(0);
  286 |     const oneMonthBefore = monthYear(-1);
  287 | 
  288 |     await test.step('TC-05-006 #2 — record current calendar month and year as the execution boundary', async () => {
  289 |       await testInfo.attach('TC-05-006 #2 — execution date boundary', {
  290 |         body: `current month/year: ${currentBoundary}`,
  291 |         contentType: 'text/plain',
  292 |       });
  293 |     });
  294 | 
  295 |     function expiryReadback(field: Locator, candidate: string) {
  296 |       return field.fill('').then(() => field.fill(candidate)).then(() =>
  297 |         field.evaluate((el) => {
  298 |           const input = el as HTMLInputElement;
  299 |           return { value: input.value, valid: input.validity.valid };
  300 |         }),
  301 |       );
  302 |     }
  303 | 
  304 |     const expiryCases: Array<{ label: string; candidate: string; shouldAccept: boolean }> = [
  305 |       { label: 'TC-05-006 #3 — 1 month before current (expired)', candidate: oneMonthBefore, shouldAccept: false },
  306 |       { label: 'TC-05-006 #4 — current month/year (earliest not expired)', candidate: currentBoundary, shouldAccept: true },
  307 |       { label: 'TC-05-006 #5 — future date 12/29', candidate: '12/29', shouldAccept: true },
  308 |       { label: 'TC-05-006 #6 — past date 01/20', candidate: '01/20', shouldAccept: false },
  309 |       { label: 'TC-05-006 #7 — non-calendar month 13/27', candidate: '13/27', shouldAccept: false },
  310 |     ];
  311 | 
  312 |     for (const c of expiryCases) {
  313 |       await test.step(c.label, async () => {
  314 |         const { value, valid } = await expiryReadback(expiryField, c.candidate);
  315 |         const fullyRetained = value.replace(/\s/g, '') === c.candidate;
  316 |         await testInfo.attach(`${c.label} — readback`, {
  317 |           body: `entered: ${c.candidate}\nreadback: ${value}\nvalid: ${valid}\nexpected accept: ${c.shouldAccept}`,
  318 |           contentType: 'text/plain',
  319 |         });
  320 |         // SPR-23: which message was shown, and which were not.
  321 |         await recordMessages(page, testInfo, c.label, [
  322 |           'Enter an expiry date',
  323 |           'Enter a valid expiry date',
  324 |           'card has expired',
  325 |           'past',
  326 |         ]);
  327 |         // Soft: same reasoning as the card-number cases.
> 328 |         expect.soft(fullyRetained && valid, `${c.label}: TPS expects this expiry date to be ${c.shouldAccept ? 'accepted' : 'rejected'} at entry`).toBe(c.shouldAccept);
      |                                                                                                                                                    ^ Error: TC-05-006 #7 — non-calendar month 13/27: TPS expects this expiry date to be rejected at entry
  329 |       });
  330 |     }
  331 | 
  332 |     await test.step('Wrap Up — navigate away without completing an order, empty cart, return home', async () => {
  333 |       await page.goto('/', { waitUntil: 'domcontentloaded' });
  334 |       const cart = new CartPage(page);
  335 |       await cart.goto();
  336 |       const remaining = await cart.lineCount();
  337 |       for (let i = remaining - 1; i >= 0; i--) {
  338 |         await cart.removeLine(i).click();
  339 |       }
  340 |       expect(await cart.lineCount()).toBe(0);
  341 |       await page.goto('/', { waitUntil: 'domcontentloaded' });
  342 |     });
  343 |   });
  344 | });
  345 | 
```