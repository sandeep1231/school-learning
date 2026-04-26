/**
 * Phase 15 — transactional mailer.
 *
 * Sends through Resend's HTTP API when RESEND_API_KEY is set; otherwise
 * logs the message to the console and returns `{ delivered: false }` so
 * dev environments behave predictably without leaking real mail. Keep
 * this module dependency-light: just `fetch`, no SDK.
 *
 * Env:
 *   RESEND_API_KEY   — required to actually deliver
 *   MAIL_FROM        — "Sikhya Sathi <noreply@sikhyasathi.app>" (defaults to a placeholder)
 *   MAIL_REPLY_TO    — optional reply-to header
 */

export type MailMessage = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

export type MailResult = {
  delivered: boolean;
  id?: string;
  error?: string;
};

const ENDPOINT = "https://api.resend.com/emails";

function fromAddress(): string {
  return (
    process.env.MAIL_FROM ??
    "Sikhya Sathi <noreply@sikhyasathi.app>"
  );
}

export function mailerConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export async function sendMail(msg: MailMessage): Promise<MailResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    // Dev fallback — log the headline so engineers can verify the trigger.
    // Do NOT log full HTML body (may contain UTRs etc.).
    console.info(
      `[mailer] RESEND_API_KEY missing; would send to=${msg.to} subject="${msg.subject}"`,
    );
    return { delivered: false };
  }
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromAddress(),
        to: [msg.to],
        subject: msg.subject,
        html: msg.html,
        text: msg.text,
        reply_to: process.env.MAIL_REPLY_TO,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return {
        delivered: false,
        error: `resend ${res.status}: ${body.slice(0, 300)}`,
      };
    }
    const json = (await res.json().catch(() => ({}))) as { id?: string };
    return { delivered: true, id: json.id };
  } catch (err) {
    return { delivered: false, error: (err as Error).message };
  }
}

/**
 * Minimal HTML escape so user-controlled fields (UTR, plan title) can't
 * inject markup into the email body.
 */
export function esc(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
