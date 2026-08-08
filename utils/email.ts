import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { IMAP_CONFIG } from '../fixtures/credentials';

/**
 * Polls the test inbox for the most recent email matching a subject
 * substring, arriving after `since`. Needed because the live store
 * sends real email via Shopify's own mail system for order confirmation
 * (TP-05-008), the order-status link (TP-06-017), and password reset
 * (TP-07-016/017) — there's no way to get those links without reading a
 * real inbox.
 *
 * Uses mailparser's simpleParser rather than regexing the raw IMAP
 * source directly, since real email bodies are typically
 * quoted-printable or base64 encoded — a naive regex would miss or
 * mangle links.
 */
export async function waitForEmail(
  subjectContains: string,
  since: Date,
  timeoutMs = 60_000,
): Promise<{ subject: string; text: string; html: string }> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const client = new ImapFlow({
      host: IMAP_CONFIG.host(),
      port: IMAP_CONFIG.port(),
      secure: true,
      auth: { user: IMAP_CONFIG.user(), pass: IMAP_CONFIG.appPassword() },
      logger: false,
    });

    await client.connect();
    try {
      const lock = await client.getMailboxLock('INBOX');
      try {
        const uids = await client.search({ since, subject: subjectContains }, { uid: true });
        if (uids && uids.length > 0) {
          const newestUid = uids[uids.length - 1];
          const message = await client.fetchOne(String(newestUid), { source: true }, { uid: true });
          if (message && message.source) {
            const parsed = await simpleParser(message.source);
            return {
              subject: parsed.subject ?? '',
              text: parsed.text ?? '',
              html: typeof parsed.html === 'string' ? parsed.html : '',
            };
          }
        }
      } finally {
        lock.release();
      }
    } finally {
      await client.logout();
    }

    await new Promise((resolve) => setTimeout(resolve, 3_000));
  }

  throw new Error(`No email matching subject "${subjectContains}" arrived within ${timeoutMs}ms.`);
}

/** Pulls the href of the first link in an email whose visible text matches linkText (e.g. "View order"). */
export function extractLink(html: string, linkText: string): string | null {
  const pattern = new RegExp(`<a[^>]+href=["']([^"']+)["'][^>]*>[^<]*${linkText}[^<]*</a>`, 'i');
  const match = html.match(pattern);
  return match ? match[1].replace(/&amp;/g, '&') : null;
}
