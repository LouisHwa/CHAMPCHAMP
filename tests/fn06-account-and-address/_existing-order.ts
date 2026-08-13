import { Browser, TestInfo, expect } from '@playwright/test';
import { HeaderBar } from '../../pages/HeaderBar';
import { MyAccountPage } from '../../pages/MyAccountPage';
import { OrderDetailPage } from '../../pages/OrderDetailPage';
import { recordUrl } from '../../utils/evidence';
import { waitForEmail, extractLink } from '../../utils/email';
import { videoOptions } from './_helpers';

const STORAGE_STATE_PATH = 'playwright/.auth/user.json';
const BASE_URL = 'https://sauce-demo.myshopify.com';

export type ExistingOrder = {
  detailUrl: string;
  detailPageText: string;
  viewOrderLink: string | null;
};

/**
 * ENV-15 ("a completed order of at least two items, associated with
 * TEST_ACCOUNT, with its confirmation email available") is read here
 * rather than placed by automation. A first attempt at placing the order
 * itself (via a storageState-transplanted session through checkout)
 * confirmed live that checkout does NOT honor the transplanted session —
 * it kept showing a "Sign in" prompt and an empty Contact email — so the
 * resulting order was never actually associated with the account, AND
 * completing checkout that way invalidated the session server-side
 * (TEST_ACCOUNT's storageState came back SIGNED OUT afterward). Per
 * instruction, the order is placed by a human in a normal browser
 * instead; this just reads whatever "Your Orders" shows most recently,
 * comparing pages against each other rather than against a value someone
 * had to write down.
 *
 * The confirmation email's actual button text is "View your order", not
 * "View order" as the TPS document states (confirmed live, 9 Aug) — a
 * test-data wording gap, not a defect.
 */
export async function readMostRecentOrderForTestAccount(browser: Browser, testInfo: TestInfo) {
  const context = await browser.newContext({ baseURL: BASE_URL, storageState: STORAGE_STATE_PATH, ...videoOptions(testInfo) });
  const page = await context.newPage();
  const header = new HeaderBar(page);
  const myAccount = new MyAccountPage(page);
  const orderDetail = new OrderDetailPage(page);

  await myAccount.goto();
  const url = page.url();
  expect(url, 'Session must be signed in and "Your Orders" must list at least one order — place one manually first.').not.toContain('/account/login');
  const orderCount = await myAccount.orderRows.count();
  expect(orderCount, 'No orders found under TEST_ACCOUNT — place a real order (2+ items) manually first.').toBeGreaterThan(0);

  await myAccount.orderLink(0).click();
  await page.waitForLoadState('domcontentloaded');
  const detailUrl = await recordUrl(page, testInfo, 'Order detail page (existing order)');
  const detailPageText = await orderDetail.page.locator('body').innerText();

  const email = await waitForEmail('order', new Date(0), 90_000);
  const viewOrderLink = extractLink(email.html, 'View your order');
  await testInfo.attach('Confirmation email — existing order', {
    body: `subject: ${email.subject}\nView your order link: ${viewOrderLink ?? '(not found)'}`,
    contentType: 'text/plain',
  });

  const order: ExistingOrder = { detailUrl, detailPageText, viewOrderLink };
  return { context, page, header, myAccount, orderDetail, order };
}
