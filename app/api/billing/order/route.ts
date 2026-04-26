/**
 * Phase 13 — POST /api/billing/order
 *
 * Creates a new pending payment order for the authenticated student.
 * Body: { planCode: string }
 * Returns: { orderId, referenceId, upiUri, amountInr, expiresAt }
 */
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/user";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  BILLING_CONFIG,
  billingConfigured,
  buildUpiUri,
  generateReferenceId,
} from "@/lib/billing/config";
import { getPlan } from "@/lib/billing/plans";
import { rateLimit } from "@/lib/http/rate-limit";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user.isAuthenticated) {
    return NextResponse.json({ error: "auth required" }, { status: 401 });
  }
  // 5 order-creations per user per 10 minutes — blunts accidental double-clicks
  // and deliberate flooding of the payment_orders table.
  const rl = rateLimit(req, {
    key: "billing_order",
    limit: 5,
    windowMs: 10 * 60_000,
    identifier: user.id,
  });
  if (!rl.ok) return rl.response;
  if (!billingConfigured()) {
    return NextResponse.json(
      { error: "billing not configured" },
      { status: 503 },
    );
  }

  let body: { planCode?: string };
  try {
    body = (await req.json()) as { planCode?: string };
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (!body.planCode) {
    return NextResponse.json({ error: "planCode required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const plan = await getPlan(admin, body.planCode);
  if (!plan || !plan.active) {
    return NextResponse.json({ error: "plan not found" }, { status: 404 });
  }

  const referenceId = generateReferenceId();
  const { data: row, error } = await admin
    .from("payment_orders")
    .insert({
      student_id: user.id,
      plan_code: plan.code,
      amount_inr: plan.amountInr,
      upi_vpa: BILLING_CONFIG.vpa,
      upi_payee_name: BILLING_CONFIG.payeeName,
      reference_id: referenceId,
    })
    .select("id, reference_id, amount_inr, expires_at")
    .single();
  if (error || !row) {
    return NextResponse.json(
      { error: error?.message ?? "insert failed" },
      { status: 500 },
    );
  }

  const upiUri = buildUpiUri({
    vpa: BILLING_CONFIG.vpa,
    payeeName: BILLING_CONFIG.payeeName,
    amountInr: row.amount_inr,
    reference: row.reference_id,
  });

  return NextResponse.json({
    orderId: row.id,
    referenceId: row.reference_id,
    upiUri,
    amountInr: row.amount_inr,
    expiresAt: row.expires_at,
  });
}
