/**
 * Phase 13 — GET /api/billing/order/[orderId]
 *
 * Student polls for order status (pending / submitted / paid / failed).
 */
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/user";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const { orderId } = await params;
  const user = await getCurrentUser();
  if (!user.isAuthenticated) {
    return NextResponse.json({ error: "auth required" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: order } = await admin
    .from("payment_orders")
    .select(
      "id, student_id, status, plan_code, amount_inr, reference_id, utr, expires_at, granted_until, rejection_reason",
    )
    .eq("id", orderId)
    .maybeSingle();
  if (!order || order.student_id !== user.id) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: order.id,
    status: order.status,
    planCode: order.plan_code,
    amountInr: order.amount_inr,
    referenceId: order.reference_id,
    utr: order.utr,
    expiresAt: order.expires_at,
    grantedUntil: order.granted_until,
    rejectionReason: order.rejection_reason,
  });
}
