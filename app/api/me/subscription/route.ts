import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/user";

/**
 * GET /api/me/subscription — tiny JSON snapshot for client components
 * (e.g. polling after a renewal completes). Returns 401 for guests so
 * client code can skip rendering without parsing.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user.isAuthenticated) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  return NextResponse.json({
    tier: user.subscription.tier,
    grantedUntil: user.subscription.grantedUntil,
    daysRemaining: user.subscription.daysRemaining,
    status: user.subscription.status,
  });
}
