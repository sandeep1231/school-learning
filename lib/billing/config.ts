/**
 * Phase 13 — billing config + UPI URI helpers.
 *
 * We intentionally do not depend on a payment gateway. Students pay to a
 * static merchant VPA; reconciliation happens via admin-entered UTR.
 *
 * Environment variables (see .env.local):
 *   UPI_VPA          — e.g. "sikhyasathi@okhdfcbank"
 *   UPI_PAYEE_NAME   — e.g. "Sikhya Sathi"
 *
 * Dev defaults shipped below should never see production (the API route
 * refuses to create orders unless the vars are present).
 */

export const BILLING_CONFIG = {
  vpa: process.env.UPI_VPA ?? "",
  payeeName: process.env.UPI_PAYEE_NAME ?? "Sikhya Sathi",
  currency: "INR",
} as const;

export function billingConfigured(): boolean {
  return Boolean(BILLING_CONFIG.vpa);
}

/**
 * Builds a BIP-0021-ish UPI deep link that every Indian UPI app supports.
 * Spec: https://upijs.com/upi-deep-linking/
 */
export function buildUpiUri(opts: {
  vpa: string;
  payeeName: string;
  amountInr: number;
  reference: string;
  note?: string;
}): string {
  const params = new URLSearchParams({
    pa: opts.vpa,
    pn: opts.payeeName,
    am: opts.amountInr.toFixed(2),
    cu: "INR",
    tn: (opts.note ?? `Sikhya Sathi ${opts.reference}`).slice(0, 80),
    tr: opts.reference,
  });
  return `upi://pay?${params.toString()}`;
}

/**
 * Opaque 10-char reference embedded in the UPI note so admins can tie a
 * UTR back to the order without exposing user IDs on the bank statement.
 */
export function generateReferenceId(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "SS-";
  for (let i = 0; i < 7; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}
