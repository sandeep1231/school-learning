/**
 * Phase 15 — /api/health. Lightweight liveness probe for uptime monitors.
 * Intentionally does NOT hit Supabase to keep it cheap + resilient; the DB
 * readiness check is a separate endpoint (TBD).
 */
import { NextResponse } from "next/server";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "sikhya-sathi",
    timestamp: new Date().toISOString(),
    env: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "unknown",
  });
}
