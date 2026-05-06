import { createClient as createSbClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Admin (service-role) client. NEVER import this from a client component.
 * Bypasses RLS — only use from server-only surfaces (cron, ingest scripts,
 * trusted server actions after explicit authorization checks).
 *
 * Cached at module scope: the underlying client is stateless (no session,
 * no refresh) so reusing it across requests just amortises the ~10-30ms
 * TLS / fetch-internals setup that happens on first use.
 */
let cached: SupabaseClient | null = null;

export function createAdminClient(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase admin env vars missing");
  }
  cached = createSbClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
