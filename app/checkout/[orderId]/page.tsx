/**
 * Phase 13 — /checkout/[orderId]. Server component that renders the UPI QR
 * + pay-to details, and embeds a client panel for UTR submission + polling.
 */
import { notFound, redirect } from "next/navigation";
import QRCode from "qrcode";
import { getCurrentUser } from "@/lib/auth/user";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildUpiUri, BILLING_CONFIG } from "@/lib/billing/config";
import { CheckoutPanel } from "./CheckoutPanel";

export const dynamic = "force-dynamic";

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  const user = await getCurrentUser();
  if (!user.isAuthenticated) {
    redirect(`/auth/sign-in?redirect=/checkout/${orderId}`);
  }

  const admin = createAdminClient();
  const { data: order } = await admin
    .from("payment_orders")
    .select(
      "id, student_id, plan_code, amount_inr, upi_vpa, upi_payee_name, reference_id, status, utr, expires_at, rejection_reason",
    )
    .eq("id", orderId)
    .maybeSingle();
  if (!order || order.student_id !== user.id) notFound();

  const upiUri = buildUpiUri({
    vpa: order.upi_vpa,
    payeeName: order.upi_payee_name,
    amountInr: order.amount_inr,
    reference: order.reference_id,
  });
  const qrDataUrl = await QRCode.toDataURL(upiUri, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 320,
  });

  return (
    <main className="mx-auto max-w-xl px-4 py-10">
      <h1 className="text-2xl font-semibold">Complete your payment</h1>
      <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">
        Scan the QR with any UPI app (GPay, PhonePe, Paytm, BHIM). After paying,
        paste the UTR / reference number below so we can activate your plan.
      </p>

      <section className="mt-6 rounded-2xl border border-neutral-200 bg-white p-6 text-center dark:border-neutral-800 dark:bg-neutral-900">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={qrDataUrl}
          alt={`UPI QR for order ${order.reference_id}`}
          className="mx-auto h-72 w-72"
        />
        <dl className="mt-6 grid grid-cols-2 gap-y-2 text-left text-sm">
          <dt className="text-neutral-500">Pay to</dt>
          <dd className="font-medium">{order.upi_payee_name}</dd>
          <dt className="text-neutral-500">UPI ID</dt>
          <dd className="font-mono text-xs">{order.upi_vpa}</dd>
          <dt className="text-neutral-500">Amount</dt>
          <dd className="font-semibold">
            ₹{order.amount_inr.toLocaleString("en-IN")}
          </dd>
          <dt className="text-neutral-500">Reference</dt>
          <dd className="font-mono text-xs">{order.reference_id}</dd>
        </dl>
        <a
          href={upiUri}
          className="mt-6 inline-block rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
        >
          Open UPI app
        </a>
      </section>

      <CheckoutPanel
        orderId={order.id}
        initialStatus={order.status}
        initialUtr={order.utr}
        rejectionReason={order.rejection_reason}
        expiresAt={order.expires_at}
      />

      <p className="mt-8 text-xs text-neutral-500">
        Admin verification typically completes within a few hours. You'll get an
        in-app notification once your plan is active. Reference this order ID if
        you need support: <span className="font-mono">{order.reference_id}</span>
      </p>
    </main>
  );
}
