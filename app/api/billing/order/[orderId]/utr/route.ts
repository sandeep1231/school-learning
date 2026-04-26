/**
 * Phase 13 — POST /api/billing/order/[orderId]/utr
 *
 * Student submits the UTR / UPI reference number after paying. We move the
 * order from 'pending' to 'submitted' for admin review. No tier change yet.
 */
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/user";
import { createAdminClient } from "@/lib/supabase/admin";

const UTR_RE = /^[A-Z0-9]{8,24}$/i;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const { orderId } = await params;
  const user = await getCurrentUser();
  if (!user.isAuthenticated) {
    return NextResponse.json({ error: "auth required" }, { status: 401 });
  }

  let body: { utr?: string };
  try {
    body = (await req.json()) as { utr?: string };
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const utr = body.utr?.trim();
  if (!utr || !UTR_RE.test(utr)) {
    return NextResponse.json({ error: "invalid utr" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: order } = await admin
    .from("payment_orders")
    .select("id, student_id, status, expires_at")
    .eq("id", orderId)
    .maybeSingle();
  if (!order || order.student_id !== user.id) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (order.status !== "pending" && order.status !== "submitted") {
    return NextResponse.json(
      { error: `order already ${order.status}` },
      { status: 409 },
    );
  }
  if (new Date(order.expires_at).getTime() < Date.now()) {
    await admin
      .from("payment_orders")
      .update({ status: "expired" })
      .eq("id", orderId);
    return NextResponse.json({ error: "order expired" }, { status: 410 });
  }

  const { error: updErr } = await admin
    .from("payment_orders")
    .update({ utr, status: "submitted" })
    .eq("id", orderId);
  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
