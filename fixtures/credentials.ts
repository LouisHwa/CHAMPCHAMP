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
 * TD-05-E — the guest contact email bound in the refined TPS FN-05
 * (competitiontdc2.0@gmail.com), a separate mailbox from TEST_ACCOUNT's.
 * Used for TP-05-005's guest-order confirmation email check.
 */
export const GUEST_CONTACT = {
  email: () => requireEnv('GUEST_EMAIL'),
};

/** IMAP access to GUEST_CONTACT's inbox — separate credentials from IMAP_CONFIG. */
export const GUEST_IMAP_CONFIG = {
  host: () => requireEnv('GUEST_IMAP_HOST'),
  port: () => Number(requireEnv('GUEST_IMAP_PORT')),
  user: () => requireEnv('GUEST_IMAP_USER'),
  appPassword: () => requireEnv('GUEST_IMAP_APP_PASSWORD'),
};
