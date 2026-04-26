/**
 * Phase 13 — POST /api/billing/admin/verify
 *
 * Admin approves / rejects a submitted payment order.
 * Body: { orderId: string, action: "approve" | "reject", reason?: string }
 *
 * On approve: marks order 'paid', bumps profiles.subscription_tier, sets
 * granted_until = now + plan.duration_days.
 * On reject: marks order 'failed' with rejection_reason.
 */
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/user";
import { isAdmin } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlan } from "@/lib/billing/plans";
import { sendMail } from "@/lib/mail/mailer";
import { planActivationReceipt } from "@/lib/mail/templates";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!isAdmin(user)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let body: { orderId?: string; action?: string; reason?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (!body.orderId || (body.action !== "approve" && body.action !== "reject")) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: order } = await admin
    .from("payment_orders")
    .select("id, student_id, plan_code, status, utr, reference_id, amount_inr")
    .eq("id", body.orderId)
    .maybeSingle();
  if (!order) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (order.status !== "submitted" && order.status !== "pending") {
    return NextResponse.json(
      { error: `order already ${order.status}` },
      { status: 409 },
    );
  }

  if (body.action === "reject") {
    const { error } = await admin
      .from("payment_orders")
      .update({
        status: "failed",
        rejection_reason: body.reason ?? "UTR could not be verified.",
        verified_by: user.id,
        verified_at: new Date().toISOString(),
      })
      .eq("id", order.id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, status: "failed" });
  }

  // Approve path.
  const plan = await getPlan(admin, order.plan_code);
  if (!plan) {
    return NextResponse.json({ error: "plan missing" }, { status: 500 });
  }
  const grantedUntil = new Date(
    Date.now() + plan.durationDays * 24 * 60 * 60 * 1000,
  ).toISOString();

  const { error: orderErr } = await admin
    .from("payment_orders")
    .update({
      status: "paid",
      granted_until: grantedUntil,
      verified_by: user.id,
      verified_at: new Date().toISOString(),
    })
    .eq("id", order.id);
  if (orderErr) {
    return NextResponse.json({ error: orderErr.message }, { status: 500 });
  }

  const { error: tierErr } = await admin
    .from("profiles")
    .update({ subscription_tier: plan.tier })
    .eq("id", order.student_id);
  if (tierErr) {
    return NextResponse.json({ error: tierErr.message }, { status: 500 });
  }

  // Phase 15 — send activation receipt. Failure to send must NOT roll back
  // the activation; we only surface the delivery status to the admin UI.
  let mailStatus: { delivered: boolean; error?: string } = {
    delivered: false,
  };
  try {
    const { data: profile } = await admin
      .from("profiles")
      .select("email, full_name")
      .eq("id", order.student_id)
      .maybeSingle();
    const email = profile?.email as string | undefined;
    if (email) {
      const tmpl = planActivationReceipt({
        fullName: (profile?.full_name as string | null) ?? null,
        planTitle: plan.titleEn,
        amountInr: order.amount_inr ?? 0,
        utr: order.utr ?? "—",
        referenceId: order.reference_id ?? "—",
        grantedUntilISO: grantedUntil,
        appUrl:
          process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
          "https://sikhyasathi.app",
      });
      const result = await sendMail({
        to: email,
        subject: tmpl.subject,
        html: tmpl.html,
        text: tmpl.text,
      });
      mailStatus = {
        delivered: result.delivered,
        error: result.error,
      };
    }
  } catch (err) {
    mailStatus = { delivered: false, error: (err as Error).message };
  }

  return NextResponse.json({
    ok: true,
    status: "paid",
    grantedUntil,
    mail: mailStatus,
  });
}
