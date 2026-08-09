/**
 * Reads secrets from environment variables (populated from .env locally,
 * or GitHub Actions Secrets in CI) — never hardcode real values here.
 * Lazy getters so importing this file doesn't throw for tests that don't
 * actually need credentials; the error only fires when a value is read.
 */
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}. Copy .env.example to .env and fill it in.`);
  }
  return value;
}

/** The shopper account registered on the live store — TP-07-007 etc. */
export const TEST_ACCOUNT = {
  email: () => requireEnv('TEST_ACCOUNT_EMAIL'),
  password: () => requireEnv('TEST_ACCOUNT_PASSWORD'),
};

/** IMAP access to TEST_ACCOUNT's inbox, for confirmation/reset emails. */
export const IMAP_CONFIG = {
  host: () => requireEnv('IMAP_HOST'),
  port: () => Number(requireEnv('IMAP_PORT')),
  user: () => requireEnv('IMAP_USER'),
  appPassword: () => requireEnv('IMAP_APP_PASSWORD'),
};

/**
 * ENV-14 (TP-06-006) — a freshly registered account that has never held an
 * order or a saved address, so the account page's empty state is genuinely
 * under test rather than left behind by earlier data. Registration is
 * hCaptcha-protected the same as login, so this account is registered
 * manually, once, in a real browser — using Gmail plus-addressing
 * (e.g. competitiontdc2.0+fn06@gmail.com) so it's a distinct address to
 * the store without needing a second real Gmail account; mail for it still
 * lands in the same inbox IMAP_CONFIG already has credentials for. Its
 * session is captured separately from TEST_ACCOUNT's — see
 * FRESH_ACCOUNT_STATE_PATH — so capturing it never overwrites
 * playwright/.auth/user.json, which every other FN-06 spec still needs.
 */
export const FRESH_ACCOUNT = {
  email: () => requireEnv('FRESH_ACCOUNT_EMAIL'),
  password: () => requireEnv('FRESH_ACCOUNT_PASSWORD'),
};

export const FRESH_ACCOUNT_STATE_PATH = 'playwright/.auth/fresh-user.json';
