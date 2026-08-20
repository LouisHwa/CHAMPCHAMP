import { test } from '../../utils/pacedTest';
import { CheckoutPage } from '../../pages/CheckoutPage';
import { addProductAndGoToCheckout, fillDeliveryAddress, NAME_ON_CARD } from '../fn05-checkout/_helpers';

/**
 * TEMPORARY PROBE — not a test procedure, discharges no coverage item.
 *
 * Run 1 established that a real card number is refused for its SCHEME
 * ("This store doesn't accept Visa"), and that blurring an invalid expiry
 * or security code renders nothing at all.
 *
 * Run 2 established the oracle: with the DECLINED simulation value held
 * constant, a valid expiry/CVV submission reaches the gateway and shows
 * "There was an issue processing your payment", while an invalid expiry or
 * CVV shows NOTHING — the store blocks the submission silently.
 *
 * Run 3 (this one) exists because the first rewrite of TP-05-003 read that
 * oracle wrongly: Shopify never CLEARS a previous submission's [role=alert],
 * so every verdict after the first refusal matched a stale message. Two
 * candidate fixes, and this probe decides between them:
 *
 *   1. Reload the checkout between submissions. Needs to be known whether
 *      the contact email and delivery address survive a reload, or whether
 *      every submission would have to re-enter the whole form.
 *   2. Read the SUBMISSION itself off the network rather than off the DOM.
 *      If a request fires when the form submits and none fires when it is
 *      blocked client-side, that is an exact oracle with no stale state.
 *
 * Run:  INFRA=1 npx playwright test tests/_infra/probe-payment-validation.spec.ts --project=chromium
 *
 * Uses the declined simulation value only, which can never complete an order.
 */

test('PROBE alert staleness and submission network signal', async ({ page }, testInfo) => {
    test.setTimeout(300_000);

    const requests: string[] = [];
    page.on('request', (r) => {
        if (r.method() === 'POST' || /graphql/i.test(r.url())) {
            requests.push(`${r.method()} ${r.url().split('?')[0]}${/graphql/i.test(r.url()) ? ` [op=${(r.postData() ?? '').match(/"operationName":"([^"]+)"/)?.[1] ?? '?'}]` : ''}`);
        }
    });

    const { checkout } = await addProductAndGoToCheckout(page);
    await checkout.emailField.fill('competitiontdc2.0@gmail.com');
    await fillDeliveryAddress(page, checkout, 'United Kingdom');

    async function alertsNow(): Promise<string[]> {
        return (await page.locator('[role="alert"], [aria-live="polite"], [aria-live="assertive"]').allInnerTexts())
            .map((t) => t.trim())
            .filter((t) => t && !/^(Pay now|Apply)$/.test(t));
    }

    async function submit(label: string, card: string, expiry: string, cvv: string) {
        requests.length = 0;
        const before = await alertsNow();

        await checkout.cardField('Card number').fill('');
        await checkout.cardField('Card number').fill(card);
        await checkout.cardField('Expiration date (MM / YY)').fill('');
        await checkout.cardField('Expiration date (MM / YY)').fill(expiry);
        await checkout.cardField('Security code').fill('');
        await checkout.cardField('Security code').fill(cvv);
        await checkout.cardField('Name on card').fill(NAME_ON_CARD);
        await page.waitForTimeout(500);

        await checkout.payNowButton.click();
        await page.waitForTimeout(9000);

        const after = await alertsNow();
        // Only requests plausibly related to submitting the checkout.
        const interesting = [...new Set(requests)].filter((r) => /checkout|graphql|payment|session/i.test(r));

        console.log(
            `\n===== ${label} =====\n` +
            `  alerts BEFORE: ${JSON.stringify(before)}\n` +
            `  alerts AFTER:  ${JSON.stringify(after)}\n` +
            `  alerts CHANGED: ${JSON.stringify(before) !== JSON.stringify(after)}\n` +
            `  requests fired (${interesting.length}):\n${interesting.map((r) => `    ${r}`).join('\n') || '    (none)'}\n`,
        );
        await testInfo.attach(`PROBE ${label}`, {
            body: JSON.stringify({ before, after, requests: interesting }, null, 2),
            contentType: 'application/json',
        });
    }

    // 1. Valid values -> should submit, fire a request, show the decline.
    await submit('A: VALID expiry+CVV (expect submit + decline message)', '2', '12/29', '123');

    // 2. Bad expiry immediately after -> the decline alert from A is still on
    //    screen. Does a request fire? Do the alerts change?
    await submit('B: BAD expiry 01/20, straight after A (stale alert case)', '2', '01/20', '123');

    // 3. Bad CVV, same situation.
    await submit('C: BAD CVV 12, straight after B', '2', '12/29', '12');

    // 4. Does reloading the checkout clear the alert, and does the form
    //    survive it? This decides fix option 1.
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(4000);
    const afterReload = {
        url: page.url(),
        alerts: await alertsNow(),
        email: await checkout.emailField.inputValue().catch(() => '(field absent)'),
        city: await checkout.deliveryField('City').inputValue().catch(() => '(field absent)'),
        postcode: await checkout.deliveryField('Postcode').inputValue().catch(() => '(field absent)'),
        payNowVisible: await checkout.payNowButton.isVisible().catch(() => false),
    };
    console.log(`\n===== D: AFTER RELOAD =====\n${JSON.stringify(afterReload, null, 2)}\n`);
    await testInfo.attach('PROBE D: after reload', {
        body: JSON.stringify(afterReload, null, 2),
        contentType: 'application/json',
    });
});
