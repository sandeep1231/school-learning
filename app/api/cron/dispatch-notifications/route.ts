import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  describeProviders,
  getProvider,
  type NotificationChannel,
} from "@/lib/notifications/providers";

export const runtime = "nodejs";

/**
 * Cron worker: drain `notifications_outbox` rows whose status='queued'.
 *
 * Schedule alongside the daily-summary cron (e.g. on Render Cron, run this
 * 5-10 minutes after the summary cron so rows are ready to send).
 *
 *   POST /api/cron/dispatch-notifications
 *   Authorization: Bearer $CRON_SECRET
 *
 * The worker:
 *   1. Pulls up to BATCH_SIZE queued rows, oldest-first.
 *   2. Batch-fetches recipient profile + auth.users email in one query.
 *   3. Calls the registered provider for each row's channel (live or log-only
 *      depending on env vars — see lib/notifications/providers.ts).
 *   4. Marks each row sent / failed with sent_at and error.
 *
 * No per-row retry inside this worker — failed rows are left for a future
 * retry pass (which would re-query status='failed' with bounded attempts;
 * out of scope for v1 to keep the worker simple and idempotent).
 */
const BATCH_SIZE = 50;

type OutboxRow = {
  id: string;
  recipient_profile_id: string | null;
  channel: NotificationChannel;
  template: string;
  payload: Record<string, unknown>;
};

type AuthUser = { id: string; email: string | null };
type ProfileRow = {
  id: string;
  full_name: string | null;
  phone: string | null;
  preferred_language: string | null;
};

export async function POST(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const sb = createAdminClient();

  const { data: rows, error: rowsErr } = await sb
    .from("notifications_outbox")
    .select("id, recipient_profile_id, channel, template, payload")
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(BATCH_SIZE);
  if (rowsErr) {
    return NextResponse.json(
      { error: "fetch_failed", detail: rowsErr.message },
      { status: 500 },
    );
  }
  if (!rows || rows.length === 0) {
    return NextResponse.json({
      ok: true,
      processed: 0,
      providers: describeProviders(),
    });
  }

  const recipientIds = Array.from(
    new Set(
      (rows as OutboxRow[])
        .map((r) => r.recipient_profile_id)
        .filter((x): x is string => Boolean(x)),
    ),
  );

  // Fetch profile + email together. profiles has phone/name; auth.users has
  // email. Both keyed on the same id so we can merge into a single map.
  let profilesById = new Map<string, ProfileRow>();
  let emailsById = new Map<string, string | null>();
  if (recipientIds.length > 0) {
    const { data: profileRows } = await sb
      .from("profiles")
      .select("id, full_name, phone, preferred_language")
      .in("id", recipientIds);
    profilesById = new Map(
      ((profileRows ?? []) as ProfileRow[]).map((p) => [p.id, p]),
    );

    // auth.users is in the auth schema; service-role can read it.
    const { data: authRows } = await sb
      .schema("auth")
      .from("users")
      .select("id, email")
      .in("id", recipientIds);
    emailsById = new Map(
      ((authRows ?? []) as AuthUser[]).map((u) => [u.id, u.email ?? null]),
    );
  }

  let sent = 0;
  let failed = 0;
  let logged = 0;
  const nowIso = new Date().toISOString();

  for (const row of rows as OutboxRow[]) {
    if (!row.recipient_profile_id) {
      await sb
        .from("notifications_outbox")
        .update({
          status: "failed",
          error: "no_recipient",
          sent_at: nowIso,
        })
        .eq("id", row.id);
      failed += 1;
      continue;
    }

    const profile = profilesById.get(row.recipient_profile_id);
    const email = emailsById.get(row.recipient_profile_id) ?? null;
    const provider = getProvider(row.channel);

    const result = await provider.send({
      to: {
        email,
        phone: profile?.phone ?? null,
        name: profile?.full_name ?? null,
      },
      template: row.template,
      payload: row.payload ?? {},
      language: profile?.preferred_language ?? "en",
    });

    if (result.ok) {
      await sb
        .from("notifications_outbox")
        .update({ status: "sent", sent_at: nowIso, error: null })
        .eq("id", row.id);
      sent += 1;
      if (result.mode === "logged") logged += 1;
    } else {
      await sb
        .from("notifications_outbox")
        .update({
          status: "failed",
          error: result.error.slice(0, 500),
          sent_at: nowIso,
        })
        .eq("id", row.id);
      failed += 1;
    }
  }

  console.log(
    JSON.stringify({
      event: "cron.dispatch_notifications",
      processed: rows.length,
      sent,
      failed,
      logged,
      providers: describeProviders(),
    }),
  );

  return NextResponse.json({
    ok: true,
    processed: rows.length,
    sent,
    failed,
    logged,
    providers: describeProviders(),
  });
}
