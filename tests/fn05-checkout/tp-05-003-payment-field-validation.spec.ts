import { test, expect } from '../../utils/pacedTest';
import type { Page, TestInfo } from '@playwright/test';
import { CartPage } from '../../pages/CartPage';
import { HeaderBar } from '../../pages/HeaderBar';
import { CheckoutPage } from '../../pages/CheckoutPage';
import {
  addProductAndGoToCheckout,
  fillDeliveryAddress,
  recordMessages,
  recordFieldContents,
  recordSimulationValue,
  SIMULATION_VALUES,
  NAME_ON_CARD,
} from './_helpers';
import { recordUrl } from '../../utils/evidence';

/**
 * TP-05-003 — Verify the card number field accepts lengths within 13 to 19
 * digits and rejects lengths outside that range and non-numeric input, that
 * it accepts a number satisfying the Luhn check digit and rejects one that
 * fails it at constant length, that the security code field accepts 3- and
 * 4-digit values and rejects values outside that range, and that the expiry
 * date field accepts a future date and rejects expired or non-calendar
 * dates. Covers TC-05-003, TC-05-004, TC-05-005, TC-05-006.
 *
 * PARTIALLY BLOCKED — A-010. TC-05-003, TC-05-004 and TC-05-005 #5 are
 * blocked; TC-05-005 (its remaining steps) and TC-05-006 are executable and
 * are the ones this procedure reports on. See "What is blocked" below.
 *
 * ---------------------------------------------------------------------
 * WHY THIS PROCEDURE SUBMITS, AND WHY IT USED NOT TO
 * ---------------------------------------------------------------------
 * SPR-27: "Payment field validation is reported on submission of the
 * Payment section, not on entry. Where a step enters a payment value under
 * test, submit the section to obtain the verdict, record the messages
 * shown, then reset the field before the next value."
 *
 * The TCS cites SPR-27 on all four of these test cases. The TPS does not —
 * its Set Up steps cite only (SPR-16, SPR-23), and SPR-27 was lost when the
 * four cases were merged into one procedure. This spec followed the TPS and
 * therefore never submitted anything: it typed each candidate into the PCI
 * iframe and read back input.value and input.validity.valid.
 *
 * That oracle was wrong twice over, confirmed live on 20 August:
 *
 *   * validity.valid is the browser's NATIVE constraint check. Shopify's
 *     checkout validation is React-rendered error text and never touches
 *     it, so it reads true for essentially any non-empty value. Every
 *     candidate therefore looked "accepted".
 *   * Playwright's fill() leaves focus in the field, so nothing was ever
 *     committed. Blurring does not help either — a probe blurred expiry
 *     01/20 and security code 12 and the store rendered nothing at all.
 *
 * The procedure consequently reported that no Luhn check is applied and
 * that expiry validity is not enforced. Both were artefacts of the oracle,
 * and both reached the Test Log as TC-05-004 and TC-05-006 failures. They
 * are withdrawn.
 *
 * ---------------------------------------------------------------------
 * THE ORACLE
 * ---------------------------------------------------------------------
 * Confirmed live, 20 August, by submitting the same form four times with
 * one field varied:
 *
 *   declined card + valid expiry + valid CVV  ->  "There was an issue
 *                                                  processing your payment."
 *   declined card + expiry 01/20              ->  nothing at all
 *   declined card + expiry 13/27              ->  nothing at all
 *   declined card + security code 12          ->  nothing at all
 *
 * So the store DOES enforce expiry and security code — it silently refuses
 * to submit — but reports no message when it does. Silence is the refusal,
 * not an absence of behaviour.
 *
 * THE VERDICT IS READ OFF THE NETWORK, NOT THE DOM. A first attempt at this
 * classified on the [role="alert"] text and was wrong: Shopify never CLEARS
 * a previous submission's alert, so from the first refusal onward every
 * verdict matched a stale message. A probe on 20 August showed the trap is
 * not fixable by comparing before/after text either —
 *
 *   valid expiry + CVV  ->  POST .../graphql/persisted [SubmitForCompletion]
 *                           alert becomes "issue processing your payment"
 *   bad expiry 01/20    ->  NO requests at all
 *                           alert stays BYTE-IDENTICAL to the previous one
 *   bad CVV 12          ->  NO requests at all
 *                           alert stays BYTE-IDENTICAL to the previous one
 *
 * — two consecutive refusals are indistinguishable in the DOM. The
 * SubmitForCompletion request is the exact signal: it fires when the form
 * submits and never fires when the store blocks it client-side.
 *
 *   SubmitForCompletion fired  ->  the value under test was ACCEPTED
 *   no request                 ->  the value under test was REFUSED
 *
 * The checkout is still reloaded before every submission, so that any
 * message present afterwards is genuinely this submission's and the card
 * scheme refusal can be told apart from a silent block. Confirmed live that
 * a reload preserves the contact email and delivery address, so the form
 * does not have to be re-entered.
 *
 * A control submission runs FIRST, with wholly valid values, and hard-asserts
 * that SubmitForCompletion fires. If the request name ever changes, that is
 * where the procedure stops — rather than reporting twenty silent refusals.
 *
 * The card number is held at TD-05-P2, the DECLINED simulation value,
 * throughout the expiry and security code cases. A declined outcome can
 * never complete an order, so the form may be submitted as often as the
 * partitions require without placing one. No order is completed by this
 * procedure and SPR-18 does not apply, matching the TPS's own note.
 *
 * ---------------------------------------------------------------------
 * WHAT IS BLOCKED, AND WHY IT IS NOT A DEFECT
 * ---------------------------------------------------------------------
 * Submitting a real card number returns:
 *
 *   "This store doesn't accept Visa. Use a different card to pay."
 *
 * The value is refused for its SCHEME, before length or check digit is
 * considered at all. No card number under TC-05-003 or TC-05-004 can
 * therefore be judged against REQ-F5-09 or REQ-F5-10: the accepted-length
 * value and the rejected-length value produce the identical outcome, as do
 * the Luhn-valid and Luhn-invalid values. The partitions cannot be
 * discriminated in this environment.
 *
 * That is A-010, and the TCS already directs this outcome: "Card number
 * length and check digit behaviour therefore cannot be discriminated in
 * this environment, and TC-05-003, TC-05-004 and the maximum boundary of
 * TC-05-005 are recorded as blocked rather than failed."
 *
 * Those steps are therefore recorded as evidence and the block condition
 * is asserted once — that an accepted-length, Luhn-valid card number is
 * refused for its scheme. The TPS's expected results are NOT asserted
 * against them, because the environment cannot produce either outcome.
 * No defect is raised.
 *
 * TC-05-005 #5 is blocked for the same reason: it pairs the 4-digit code
 * with an American Express card number, and no card scheme is accepted.
 *
 * ---------------------------------------------------------------------
 * A GAP THIS OPENS IN THE TPS
 * ---------------------------------------------------------------------
 * TP-05-003's Set Up never enters a contact email, because it was written
 * for a procedure that never submits. The first probe run submitted without
 * one and the ONLY field flagged was input[name="email"] — the card was
 * never evaluated. That is SPR-27's "one field's error may suppress
 * another's on the same submission" in practice. TD-05-E is entered at Set
 * Up here so that the field under test is the field being judged; the TPS
 * needs the same step adding.
 */

/** The store's gateway-decline text. Its presence means the submission reached the gateway. */
const GATEWAY_REACHED = /issue processing your payment/i;
/** The store's card-scheme refusal. Its presence is the A-010 block condition. */
const SCHEME_REFUSED = /(does ?n[o']?t accept|not accepted)/i;

type Verdict = {
  messages: string[];
  submitted: boolean;
  reachedGateway: boolean;
  schemeRefused: boolean;
  url: string;
};

/** Live-region text that is page furniture rather than a verdict, confirmed live. */
const ALERT_NOISE = /^(Pay now|Apply|Your order.s being processed\.?)$/i;

/**
 * Submits the Payment section with one candidate value and classifies the
 * outcome.
 *
 * Reloads first, so any message present afterwards belongs to THIS
 * submission — Shopify leaves the previous one on screen indefinitely. The
 * contact email and delivery address survive the reload (confirmed live);
 * the PCI card fields do not, which is harmless because every field is
 * refilled here anyway. Refilling is required regardless: the store clears
 * the payment fields after a declined submission, which TC-05-014 #3
 * asserts in its own right.
 *
 * The accepted/refused verdict comes from whether SubmitForCompletion
 * fires, not from the DOM — see the header. The message text is still
 * collected, because it is what separates a CARD SCHEME refusal (A-010)
 * from a silent client-side block, and because SPR-23 requires it.
 */
async function submitAndClassify(
  page: Page,
  checkout: CheckoutPage,
  values: { card: string; expiry: string; cvv: string },
): Promise<Verdict> {
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(checkout.payNowButton).toBeVisible({ timeout: 30_000 });
  await expect(checkout.cardField('Card number')).toBeVisible({ timeout: 30_000 });

  await checkout.cardField('Card number').fill(values.card);
  await checkout.cardField('Expiration date (MM / YY)').fill(values.expiry);
  await checkout.cardField('Security code').fill(values.cvv);
  await checkout.cardField('Name on card').fill(NAME_ON_CARD);

  // Armed BEFORE the click, or a fast submission could resolve first.
  const submission = page
    .waitForRequest(
      (r) =>
        r.method() === 'POST' &&
        /\/checkouts\/internal\/graphql/.test(r.url()) &&
        /"operationName"\s*:\s*"SubmitForCompletion"/.test(r.postData() ?? ''),
      { timeout: 15_000 },
    )
    .then(() => true)
    .catch(() => false);

  await expect(checkout.payNowButton).toBeEnabled({ timeout: 10_000 });
  await checkout.payNowButton.click();

  const submitted = await submission;
  // A submission that DID go through needs a moment for the gateway's reply
  // to render; one that never fired has nothing to wait for.
  await page.waitForTimeout(submitted ? 8_000 : 2_500);

  const alerts = page.locator('[role="alert"], [aria-live="polite"], [aria-live="assertive"]');
  const messages = [...new Set((await alerts.allInnerTexts()).map((t) => t.trim()).filter(Boolean))].filter(
    (t) => !ALERT_NOISE.test(t),
  );

  const joined = messages.join(' | ');
  const url = page.url();

  // SPR-18 safeguard. Nothing here should ever complete an order: every
  // submission uses either a card scheme the store refuses or the declined
  // simulation value. If one completes anyway, stop immediately — the
  // confirmation number has to be recorded, and continuing would place more.
  if (/thank[_-]?you|\/orders\//i.test(url)) {
    throw new Error(
      `TP-05-003 ABORTED: an order COMPLETED at ${url} while submitting ` +
        `card "${values.card}", expiry "${values.expiry}", CVV "${values.cvv}". ` +
        `No value used by this procedure should ever complete one. Record the ` +
        `confirmation number under SPR-18 before re-running.`,
    );
  }

  return {
    messages,
    submitted,
    reachedGateway: GATEWAY_REACHED.test(joined),
    schemeRefused: SCHEME_REFUSED.test(joined),
    url,
  };
}

/** Attaches the full verdict for a submission, so the report shows what was judged and on what basis. */
async function recordVerdict(testInfo: TestInfo, label: string, values: { card: string; expiry: string; cvv: string }, v: Verdict) {
  // Scheme first: a scheme refusal is a distinct outcome from both accepted
  // and refused, and it is the A-010 block condition.
  const outcome = v.schemeRefused
    ? 'BLOCKED (A-010) — refused for its card scheme, before length or check digit is considered'
    : v.submitted
      ? 'ACCEPTED — the value was committed and the submission reached the payment gateway'
      : 'REFUSED — the store blocked the submission client-side; no request was sent and no message displayed';
  await testInfo.attach(`${label} — submission verdict`, {
    body:
      `card number entered:      ${values.card}\n` +
      `expiry entered:           ${values.expiry}\n` +
      `security code entered:    ${values.cvv}\n` +
      `SubmitForCompletion sent: ${v.submitted}\n` +
      `messages displayed:       ${v.messages.length ? v.messages.join(' | ') : '(none displayed)'}\n` +
      `gateway decline shown:    ${v.reachedGateway}\n` +
      `refused for card scheme:  ${v.schemeRefused}\n` +
      `outcome:                  ${outcome}\n\n` +
      `Verdict basis: whether the checkout issued its SubmitForCompletion request. The DOM cannot be\n` +
      `used — the store leaves the previous submission's message on screen, so two consecutive\n` +
      `refusals are byte-identical (confirmed live, 20 August).`,
    contentType: 'text/plain',
  });

  // Also to the terminal. The HTML report keeps attachment bodies inline and
  // they cannot be read back from the command line, so without this a run's
  // verdicts can only be reviewed by opening the report in a browser — which
  // makes spot-checking the classification against the raw signal harder than
  // it should be.
  console.log(
    `  ${label.padEnd(52)} card=${values.card.padEnd(23)} exp=${values.expiry.padEnd(6)} ` +
      `cvv=${(values.cvv || '(empty)').padEnd(8)} submitted=${String(v.submitted).padEnd(5)} -> ${outcome.split(' —')[0]}`,
  );
}

function monthYear(offsetMonths: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + offsetMonths);
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear() % 100).padStart(2, '0')}`;
}

const DECLINED = SIMULATION_VALUES.declined.value;
const VALID_EXPIRY = '12/29';
const VALID_CVV = '123';

test.describe('FN-05 Checkout', () => {
  test('TP-05-003 [PARTIAL A-010] Payment field validation', async ({ page }, testInfo) => {
    // 22 submissions of a live checkout, each a full round trip to the
    // payment gateway. The refused cases cannot short-circuit — silence is
    // their verdict, so each serves out the full poll ceiling.
    test.setTimeout(900_000);

    testInfo.annotations.push({
      type: 'blocked',
      description:
        'A-010 (partial): the store accepts no card scheme, so every card number is refused for its scheme ' +
        'before length or check digit is considered. TC-05-003, TC-05-004 and TC-05-005 #5 cannot be ' +
        'discriminated and are recorded as blocked per TCS 2.3.5. TC-05-005 (remaining steps) and TC-05-006 ' +
        'are executable and are asserted.',
    });

    await test.step('Set Up — confirm no shopper signed in and an empty cart baseline (ENV-08)', async () => {
      const header = new HeaderBar(page);
      await header.gotoHome();
      const signedOut = await header.logInLink.isVisible().catch(() => false);

      const cart = new CartPage(page);
      await cart.goto();
      const remaining = await cart.lineCount();
      for (let i = remaining - 1; i >= 0; i--) await cart.removeLine(i).click();
      await cart.goto();
      const lines = await cart.lineCount();

      await testInfo.attach('Set Up — preconditions', {
        body: `"Log In" control visible (i.e. no shopper signed in): ${signedOut}\ncart lines at baseline: ${lines}`,
        contentType: 'text/plain',
      });
      expect(signedOut, 'ENV-01: no shopper account should be signed in at Set Up').toBe(true);
      expect(lines, 'ENV-08: the cart should be empty at Set Up').toBe(0);
    });

    const { checkout } = await addProductAndGoToCheckout(page);

    await test.step('Set Up — enter the contact email so the field under test is the field being judged', async () => {
      // Not in the TPS, and required. Submitting without it flags
      // input[name="email"] and nothing else, so no payment value is ever
      // evaluated — SPR-27's message-suppression warning in practice.
      await checkout.emailField.fill('competitiontdc2.0@gmail.com');
      await testInfo.attach('Set Up — contact email (TD-05-E)', {
        body:
          'Entered so that a submission is judged on the payment field under test rather than ' +
          'rejected for a missing contact address. Confirmed live: submitting without it flagged ' +
          'input[name="email"] alone and the card was never evaluated (SPR-27).',
        contentType: 'text/plain',
      });
    });

    await fillDeliveryAddress(page, checkout, 'United Kingdom');
    await recordUrl(page, testInfo, 'Payment section reached');

    await test.step('Set Up — confirm the checkout testing panel is present (ENV-11)', async () => {
      const panelVisible = await checkout.testPaymentGatewayButton
        .or(page.getByText('Testing instruction'))
        .first()
        .isVisible()
        .catch(() => false);
      await testInfo.attach('Set Up — checkout testing panel', {
        body: `testing panel present in the Payment section: ${panelVisible}`,
        contentType: 'text/plain',
      });
      expect(panelVisible, 'ENV-11: the checkout testing panel should be present in the Payment section').toBe(true);
    });

    await test.step('TC-05-003 #1 — Payment section displays card number, expiry, security code and name fields', async () => {
      await expect(checkout.cardField('Card number')).toBeVisible();
      await expect(checkout.cardField('Expiration date (MM / YY)')).toBeVisible();
      await expect(checkout.cardField('Security code')).toBeVisible();
      await expect(checkout.cardField('Name on card')).toBeVisible();
    });

    // ------------------------------------------------------------------
    // ORACLE CONTROL — no coverage of its own.
    // ------------------------------------------------------------------
    await test.step('Set Up — calibrate the oracle: a wholly valid submission must reach the gateway', async () => {
      await recordSimulationValue(testInfo, 'oracle control', SIMULATION_VALUES.declined);
      const values = { card: DECLINED, expiry: VALID_EXPIRY, cvv: VALID_CVV };
      const v = await submitAndClassify(page, checkout, values);
      await recordVerdict(testInfo, 'Oracle control', values, v);
      // Hard, deliberately. Every verdict below is "did SubmitForCompletion
      // fire", so if it does not fire even for wholly valid values the
      // operation has been renamed or the flow has changed, and the whole
      // procedure would report twenty silent refusals that never happened.
      // Stop here instead.
      expect(
        v.submitted,
        'Oracle control: a submission with TD-05-P2 and a valid expiry and security code must issue the ' +
          "checkout's SubmitForCompletion request. If it does not, the request this procedure watches for " +
          'has changed and every "refused" verdict below would be an artefact rather than a finding.',
      ).toBe(true);
      // Softer companion: the gateway's own decline should also be visible.
      // Worth knowing if it stops appearing, but the network signal is what
      // the verdicts actually rest on.
      expect
        .soft(v.reachedGateway, 'Oracle control: the declined simulation value should display the gateway decline message.')
        .toBe(true);
    });

    // ------------------------------------------------------------------
    // TC-05-003 — card number length and format. BLOCKED (A-010).
    // ------------------------------------------------------------------
    const cardCases: Array<{ label: string; candidate: string; tpsExpectsAccepted: boolean }> = [
      { label: 'TC-05-003 #2 — 12-digit (one below min)', candidate: '400000000002', tpsExpectsAccepted: false },
      { label: 'TC-05-003 #3 — 13-digit (at min)', candidate: '4000000000006', tpsExpectsAccepted: true },
      { label: 'TC-05-003 #4 — 16-digit (within range)', candidate: '4111111111111111', tpsExpectsAccepted: true },
      { label: 'TC-05-003 #5 — 19-digit (at max)', candidate: '4000000000000000006', tpsExpectsAccepted: true },
      { label: 'TC-05-003 #6 — 20-digit (one above max)', candidate: '40000000000000000002', tpsExpectsAccepted: false },
      { label: 'TC-05-003 #7 — 11-digit (well below range)', candidate: '40000000006', tpsExpectsAccepted: false },
      { label: 'TC-05-003 #8 — 22-digit (well above range)', candidate: '4000000000000000000002', tpsExpectsAccepted: false },
      { label: 'TC-05-003 #9 — non-numeric characters', candidate: '4111-11XY-1111', tpsExpectsAccepted: false },
    ];

    let anyCardSchemeRefusal = false;

    for (const c of cardCases) {
      await test.step(`${c.label} [BLOCKED A-010]`, async () => {
        const values = { card: c.candidate, expiry: VALID_EXPIRY, cvv: VALID_CVV };
        const v = await submitAndClassify(page, checkout, values);
        await recordVerdict(testInfo, c.label, values, v);
        // SPR-23: the field contents actually retained, so a capped field is
        // not mistaken for a refusal.
        const retained = await checkout.cardField('Card number').inputValue().catch(() => '(unreadable)');
        await recordFieldContents(testInfo, c.label, c.candidate, retained.replace(/\s/g, ''));
        await recordMessages(page, testInfo, c.label, [
          "doesn't accept",
          'Enter a card number',
          'Card number is not valid',
        ]);
        if (v.schemeRefused) anyCardSchemeRefusal = true;
        // No assertion against the TPS expected result. The store refuses
        // every card number for its scheme, so neither partition of
        // REQ-F5-09 can be observed and asserting either way would record a
        // verdict the environment cannot produce. Evidence only — A-010.
      });
    }

    // ------------------------------------------------------------------
    // TC-05-004 — Luhn check digit at constant length. BLOCKED (A-010).
    // ------------------------------------------------------------------
    for (const c of [
      { label: 'TC-05-004 #2 — 16-digit Luhn-VALID', candidate: '4000000000000002' },
      { label: 'TC-05-004 #3 — 16-digit Luhn-INVALID', candidate: '4000000000000003' },
    ]) {
      await test.step(`${c.label} [BLOCKED A-010]`, async () => {
        const values = { card: c.candidate, expiry: VALID_EXPIRY, cvv: VALID_CVV };
        const v = await submitAndClassify(page, checkout, values);
        await recordVerdict(testInfo, c.label, values, v);
        await recordMessages(page, testInfo, c.label, ["doesn't accept", 'Card number is not valid']);
        if (v.schemeRefused) anyCardSchemeRefusal = true;
      });
    }

    await test.step('A-010 block condition — an accepted-length, Luhn-valid card number is refused for its scheme', async () => {
      // This is the one assertion the card cases carry, and it asserts the
      // BLOCK, not the requirement: that the store refuses card numbers on a
      // basis other than length or check digit. It is what makes "blocked"
      // an evidenced finding rather than an assumption, and it is what will
      // start failing if the store is ever configured to accept a scheme —
      // at which point TC-05-003 and TC-05-004 become executable and this
      // procedure must be revisited.
      await testInfo.attach('A-010 block condition', {
        body:
          `at least one card number refused for its scheme: ${anyCardSchemeRefusal}\n\n` +
          `TCS 2.3.5: "Card number length and check digit behaviour therefore cannot be discriminated in ` +
          `this environment, and TC-05-003, TC-05-004 and the maximum boundary of TC-05-005 are recorded ` +
          `as blocked rather than failed."`,
        contentType: 'text/plain',
      });
      expect(
        anyCardSchemeRefusal,
        'A-010 expects the store to accept no card scheme, so every card number is refused before its ' +
          'length or check digit is considered. If this fails, the store now accepts a scheme and ' +
          'TC-05-003 / TC-05-004 are no longer blocked — re-derive them against REQ-F5-09 and REQ-F5-10.',
      ).toBe(true);
    });

    // ------------------------------------------------------------------
    // TC-05-005 — security code length. EXECUTABLE, except #5.
    // ------------------------------------------------------------------
    const cvvCases: Array<{ label: string; candidate: string; shouldAccept: boolean }> = [
      { label: 'TC-05-005 #2 — 0-digit (empty)', candidate: '', shouldAccept: false },
      { label: 'TC-05-005 #3 — 2-digit (one below min)', candidate: '12', shouldAccept: false },
      { label: 'TC-05-005 #4 — 3-digit (at min)', candidate: '123', shouldAccept: true },
      { label: 'TC-05-005 #6 — 5-digit (one above max)', candidate: '12345', shouldAccept: false },
      { label: 'TC-05-005 #7 — 7-digit (well above max)', candidate: '1234567', shouldAccept: false },
    ];

    for (const c of cvvCases) {
      await test.step(c.label, async () => {
        const values = { card: DECLINED, expiry: VALID_EXPIRY, cvv: c.candidate };
        const v = await submitAndClassify(page, checkout, values);
        await recordVerdict(testInfo, c.label, values, v);
        const retained = await checkout.cardField('Security code').inputValue().catch(() => '(unreadable)');
        await recordFieldContents(testInfo, c.label, c.candidate, retained);
        // SPR-23: which messages were shown, and which were not. Confirmed
        // live that a refusal here displays NONE of them — that absence is
        // itself the recorded outcome, not a gap in the evidence.
        await recordMessages(page, testInfo, c.label, [
          'Enter a security code',
          'Security code is not valid',
          'issue processing your payment',
        ]);
        // Soft: one rejected partition must not abort the remaining
        // equivalence set or skip the Wrap Up that empties the cart.
        expect
          .soft(
            v.submitted,
            `${c.label}: TPS expects this security code to be ${c.shouldAccept ? 'accepted' : 'rejected'}. ` +
              `Accepted is read as the checkout issuing its SubmitForCompletion request; rejected is read ` +
              `as the store blocking the submission client-side, which it does silently.`,
          )
          .toBe(c.shouldAccept);
      });
    }

    await test.step('TC-05-005 #5 — 4-digit security code with an American Express card number [BLOCKED A-010]', async () => {
      // 4 digits is the accepted length only for Amex, so the TCS pairs the
      // two deliberately — pairing it with a 3-digit-scheme card would
      // confound length with scheme. The store accepts no scheme, so the
      // pairing cannot be made and the step cannot be evaluated. Recorded as
      // evidence, asserted nowhere. TCS 2.3.5 names this step specifically
      // as blocked.
      const values = { card: '370000000000002', expiry: VALID_EXPIRY, cvv: '1234' };
      const v = await submitAndClassify(page, checkout, values);
      await recordVerdict(testInfo, 'TC-05-005 #5', values, v);
      await recordMessages(page, testInfo, 'TC-05-005 #5', ["doesn't accept", 'Security code is not valid']);
    });

    // ------------------------------------------------------------------
    // TC-05-006 — expiry date. EXECUTABLE.
    // ------------------------------------------------------------------
    const currentBoundary = monthYear(0);
    const oneMonthBefore = monthYear(-1);

    await test.step('TC-05-006 #2 — record the current calendar month and year as the execution boundary', async () => {
      await testInfo.attach('TC-05-006 #2 — execution date boundary', {
        body:
          `current month/year (the boundary):  ${currentBoundary}\n` +
          `one month before (expired):         ${oneMonthBefore}\n\n` +
          `Derived at execution rather than fixed, per the TCS note: "the boundary is the month of ` +
          `execution, so steps 3 and 4 derive their values from the date recorded at step 2".`,
        contentType: 'text/plain',
      });
    });

    const expiryCases: Array<{ label: string; candidate: string; shouldAccept: boolean }> = [
      { label: 'TC-05-006 #3 — one month before current (expired)', candidate: oneMonthBefore, shouldAccept: false },
      { label: 'TC-05-006 #4 — current month/year (earliest not expired)', candidate: currentBoundary, shouldAccept: true },
      { label: 'TC-05-006 #5 — 12/29 (well in the future)', candidate: '12/29', shouldAccept: true },
      { label: 'TC-05-006 #6 — 01/20 (in the past)', candidate: '01/20', shouldAccept: false },
      { label: 'TC-05-006 #7 — 13/27 (not a real calendar month)', candidate: '13/27', shouldAccept: false },
    ];

    for (const c of expiryCases) {
      await test.step(c.label, async () => {
        const values = { card: DECLINED, expiry: c.candidate, cvv: VALID_CVV };
        const v = await submitAndClassify(page, checkout, values);
        await recordVerdict(testInfo, c.label, values, v);
        await recordMessages(page, testInfo, c.label, [
          'Enter an expiry date',
          'Enter a valid expiry date',
          'card has expired',
          'issue processing your payment',
        ]);
        expect
          .soft(
            v.submitted,
            `${c.label}: TPS expects this expiry date to be ${c.shouldAccept ? 'accepted' : 'rejected'}. ` +
              `Accepted is read as the checkout issuing its SubmitForCompletion request; rejected is read ` +
              `as the store blocking the submission client-side, which it does silently.`,
          )
          .toBe(c.shouldAccept);
      });
    }

    await test.step('Wrap Up — navigate away without completing an order, empty the cart, return home', async () => {
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      const cart = new CartPage(page);
      await cart.goto();
      const remaining = await cart.lineCount();
      for (let i = remaining - 1; i >= 0; i--) {
        await cart.removeLine(i).click();
      }
      expect(await cart.lineCount(), 'Wrap Up: the cart should be returned to the empty-cart baseline').toBe(0);
      await page.goto('/', { waitUntil: 'domcontentloaded' });
    });
  });
});
