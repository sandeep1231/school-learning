/**
 * Phase 15 — /api/health/db. Deep readiness probe that pings Supabase
 * and the curriculum table so on-call alerting can distinguish a dead
 * runtime (covered by /api/health) from a dead database. Returns 503
 * when the DB is unreachable so a synthetic monitor can alert.
 *
 * Kept on the Node runtime because the supabase admin client uses Node
 * APIs. Cached for 10s to avoid hammering Postgres from probe storms.
 */
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 10;

export async function GET() {
  const start = Date.now();
  try {
    const admin = createAdminClient();
    const { error } = await admin
      .from("subjects")
      .select("code", { count: "exact", head: true })
      .limit(1);
    const ms = Date.now() - start;
    if (error) {
      return NextResponse.json(
        {
          ok: false,
          db: "error",
          message: error.message.slice(0, 200),
          latencyMs: ms,
        },
        { status: 503 },
      );
    }
    return NextResponse.json({
      ok: true,
      db: "up",
      latencyMs: ms,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        db: "exception",
        message: (err as Error).message.slice(0, 200),
        latencyMs: Date.now() - start,
      },
      { status: 503 },
    );
  }
}
