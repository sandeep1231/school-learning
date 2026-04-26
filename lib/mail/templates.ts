/**
 * Phase 15 — transactional email templates. Keep them small, plain, and
 * readable in any client (no images, no CSS-only-renders).
 */
import { esc } from "./mailer";

export type ReceiptInput = {
  fullName?: string | null;
  planTitle: string;
  amountInr: number;
  utr: string;
  referenceId: string;
  grantedUntilISO: string;
  appUrl: string;
};

export function planActivationReceipt(input: ReceiptInput): {
  subject: string;
  html: string;
  text: string;
} {
  const greet = input.fullName ? `Hi ${esc(input.fullName)},` : "Hi,";
  const expiry = new Date(input.grantedUntilISO).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const subject = `Sikhya Sathi · payment received for ${input.planTitle}`;
  const html = `
<!doctype html>
<html><body style="font-family:system-ui,Segoe UI,Roboto,sans-serif;color:#0f172a;background:#f8fafc;padding:24px">
  <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:24px">
    <h1 style="margin:0 0 8px;font-size:20px;color:#0f766e">Payment received</h1>
    <p style="margin:0 0 16px;color:#475569;font-size:14px">${greet} thanks for choosing Sikhya Sathi.</p>
    <table cellpadding="0" cellspacing="0" style="width:100%;font-size:14px;border-collapse:collapse">
      <tr><td style="padding:6px 0;color:#64748b">Plan</td><td style="padding:6px 0;text-align:right">${esc(input.planTitle)}</td></tr>
      <tr><td style="padding:6px 0;color:#64748b">Amount</td><td style="padding:6px 0;text-align:right">₹${input.amountInr.toLocaleString("en-IN")}</td></tr>
      <tr><td style="padding:6px 0;color:#64748b">Reference</td><td style="padding:6px 0;text-align:right;font-family:monospace">${esc(input.referenceId)}</td></tr>
      <tr><td style="padding:6px 0;color:#64748b">UTR</td><td style="padding:6px 0;text-align:right;font-family:monospace">${esc(input.utr)}</td></tr>
      <tr><td style="padding:6px 0;color:#64748b">Active until</td><td style="padding:6px 0;text-align:right">${esc(expiry)}</td></tr>
    </table>
    <p style="margin:20px 0 0">
      <a href="${esc(input.appUrl)}/today" style="display:inline-block;background:#0f766e;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;font-size:14px">Open today&rsquo;s lesson</a>
    </p>
    <p style="margin:24px 0 0;color:#94a3b8;font-size:12px">
      This is an automatic confirmation. Reply to this email if anything looks wrong, or write to support@sikhyasathi.app.
    </p>
  </div>
</body></html>`.trim();
  const text = [
    `${greet} thanks for choosing Sikhya Sathi.`,
    "",
    `Plan: ${input.planTitle}`,
    `Amount: ₹${input.amountInr.toLocaleString("en-IN")}`,
    `Reference: ${input.referenceId}`,
    `UTR: ${input.utr}`,
    `Active until: ${expiry}`,
    "",
    `Open today's lesson: ${input.appUrl}/today`,
    "",
    "Reply if anything looks wrong, or email support@sikhyasathi.app.",
  ].join("\n");
  return { subject, html, text };
}
