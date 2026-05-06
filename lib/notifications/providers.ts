/**
 * Notification provider abstraction.
 *
 * The daily-summary cron writes rows into `notifications_outbox` with a
 * channel and template, then a separate worker drains the queue and calls
 * the right provider. This file is the provider layer: each channel maps
 * to one provider, picked at runtime based on env vars.
 *
 * Wiring real providers:
 *   email:    set RESEND_API_KEY (+ optional NOTIFICATIONS_EMAIL_FROM)
 *   whatsapp: set WHATSAPP_WEBHOOK_URL + WHATSAPP_API_KEY (any HTTPS endpoint
 *             that accepts {to, template, locale, payload} — Wati / Gupshup
 *             work; format is intentionally provider-agnostic so swapping is
 *             a config change, not a code change).
 *
 * If a provider's env vars aren't set, the channel falls back to a
 * "log-only" provider that prints to stdout and marks the row as sent
 * (treat as a no-op succeed). That way development and CI don't need real
 * provider credentials and the cron flow stays exercised end-to-end.
 */

export type NotificationChannel = "email" | "whatsapp" | "sms" | "inapp";

export type SendInput = {
  to: { email?: string | null; phone?: string | null; name?: string | null };
  template: string;
  payload: Record<string, unknown>;
  language?: string;
};

export type SendResult =
  | { ok: true; providerMessageId?: string; mode: "live" | "logged" }
  | { ok: false; error: string };

export type NotificationProvider = {
  channel: NotificationChannel;
  send(input: SendInput): Promise<SendResult>;
};

// ---- Templates -------------------------------------------------------------

type TemplatedMessage = { subject: string; html: string; text: string };

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderTemplate(
  template: string,
  payload: Record<string, unknown>,
  _language: string,
): TemplatedMessage {
  if (template === "daily_summary_v1") {
    const studentName = String(payload.student_name ?? "your child");
    const date = String(payload.date ?? "");
    const note = String(payload.note ?? "");
    const subject = `Today's update from Sikhya Sathi · ${studentName}`;
    const text = `Hi,\n\n${note}\n\n— Sikhya Sathi (${date})`;
    const html = `<!doctype html>
<html><body style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#0f172a;max-width:560px;margin:24px auto;padding:0 16px">
  <h2 style="color:#0f766e;margin:0 0 8px">Today's update · ${escapeHtml(studentName)}</h2>
  <p style="color:#475569;font-size:13px;margin:0 0 16px">${escapeHtml(date)}</p>
  <div style="background:#f0fdfa;border-left:3px solid #0d9488;padding:12px 16px;border-radius:6px;line-height:1.5;white-space:pre-wrap">${escapeHtml(note)}</div>
  <p style="color:#94a3b8;font-size:12px;margin-top:24px">— Sikhya Sathi · AI tutor for BSE Odisha</p>
</body></html>`;
    return { subject, html, text };
  }
  // Generic fallback — just dump the payload.
  const subject = `Sikhya Sathi · ${template}`;
  const body = JSON.stringify(payload, null, 2);
  return {
    subject,
    text: body,
    html: `<pre>${escapeHtml(body)}</pre>`,
  };
}

// ---- Providers -------------------------------------------------------------

function makeResendProvider(): NotificationProvider | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  const from =
    process.env.NOTIFICATIONS_EMAIL_FROM ??
    "Sikhya Sathi <noreply@sikhyasathi.in>";
  return {
    channel: "email",
    async send(input) {
      if (!input.to.email) return { ok: false, error: "no_email" };
      const msg = renderTemplate(input.template, input.payload, input.language ?? "en");
      try {
        const r = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from,
            to: input.to.email,
            subject: msg.subject,
            html: msg.html,
            text: msg.text,
          }),
        });
        if (!r.ok) {
          const txt = await r.text().catch(() => "");
          return { ok: false, error: `resend_${r.status}: ${txt.slice(0, 200)}` };
        }
        const j = (await r.json().catch(() => null)) as { id?: string } | null;
        return { ok: true, providerMessageId: j?.id, mode: "live" };
      } catch (e) {
        return { ok: false, error: `resend_throw: ${(e as Error).message}` };
      }
    },
  };
}

function makeWhatsAppProvider(): NotificationProvider | null {
  const url = process.env.WHATSAPP_WEBHOOK_URL;
  const key = process.env.WHATSAPP_API_KEY;
  if (!url || !key) return null;
  return {
    channel: "whatsapp",
    async send(input) {
      if (!input.to.phone) return { ok: false, error: "no_phone" };
      const msg = renderTemplate(input.template, input.payload, input.language ?? "en");
      try {
        const r = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            to: input.to.phone,
            template: input.template,
            locale: input.language ?? "en",
            payload: input.payload,
            // Plain-text body is included so generic providers can use it
            // without re-rendering the template themselves.
            body: msg.text,
          }),
        });
        if (!r.ok) {
          const txt = await r.text().catch(() => "");
          return {
            ok: false,
            error: `whatsapp_${r.status}: ${txt.slice(0, 200)}`,
          };
        }
        const j = (await r.json().catch(() => null)) as
          | { id?: string; message_id?: string }
          | null;
        return {
          ok: true,
          providerMessageId: j?.id ?? j?.message_id,
          mode: "live",
        };
      } catch (e) {
        return { ok: false, error: `whatsapp_throw: ${(e as Error).message}` };
      }
    },
  };
}

function makeLogProvider(channel: NotificationChannel): NotificationProvider {
  return {
    channel,
    async send(input) {
      const msg = renderTemplate(input.template, input.payload, input.language ?? "en");
      console.log(
        JSON.stringify({
          event: "notification.dry_run",
          channel,
          to: input.to,
          template: input.template,
          subject: msg.subject,
          textPreview: msg.text.slice(0, 200),
        }),
      );
      return {
        ok: true,
        providerMessageId: `dryrun-${globalThis.crypto?.randomUUID?.() ?? Date.now()}`,
        mode: "logged",
      };
    },
  };
}

// In-process cache — providers are stateless, no need to construct per call.
const providerCache = new Map<NotificationChannel, NotificationProvider>();

export function getProvider(channel: NotificationChannel): NotificationProvider {
  const cached = providerCache.get(channel);
  if (cached) return cached;
  let p: NotificationProvider;
  if (channel === "email") p = makeResendProvider() ?? makeLogProvider("email");
  else if (channel === "whatsapp")
    p = makeWhatsAppProvider() ?? makeLogProvider("whatsapp");
  else p = makeLogProvider(channel);
  providerCache.set(channel, p);
  return p;
}

// Exposed for tests + the worker's observability log.
export function describeProviders(): Record<NotificationChannel, "live" | "log-only"> {
  return {
    email: process.env.RESEND_API_KEY ? "live" : "log-only",
    whatsapp:
      process.env.WHATSAPP_WEBHOOK_URL && process.env.WHATSAPP_API_KEY
        ? "live"
        : "log-only",
    sms: "log-only",
    inapp: "log-only",
  };
}
