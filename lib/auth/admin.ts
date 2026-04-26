/**
 * Phase 13 — tiny admin-auth helper.
 *
 * We gate admin-only API routes + UI behind a comma-separated allowlist of
 * emails in env (ADMIN_EMAILS). No DB role table yet — keeps launch lean.
 */
import type { CurrentUser } from "@/lib/auth/user";

function adminEmails(): Set<string> {
  const raw = process.env.ADMIN_EMAILS ?? "";
  return new Set(
    raw
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isAdmin(user: CurrentUser): boolean {
  if (!user.isAuthenticated || !user.email) return false;
  return adminEmails().has(user.email.toLowerCase());
}
