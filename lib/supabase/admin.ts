import { createClient as createSbClient } from "@supabase/supabase-js";

/**
 * Admin (service-role) client. NEVER import this from a client component.
 * Bypasses RLS — only use from server-only surfaces (cron, ingest scripts,
 * trusted server actions after explicit authorization checks).
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase admin env vars missing");
  }
  return createSbClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
