import { cookies } from "next/headers";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

export const GUEST_COOKIE = "sikhya_guest_id";

export type CurrentUser = {
  /** Unique stable id (Supabase uuid or guest cookie value). */
  id: string;
  /** True if the id comes from a real Supabase auth.users row. */
  isAuthenticated: boolean;
  /** Profile metadata if logged in. */
  email?: string | null;
  fullName?: string | null;
};

/**
 * Returns the current student identity.
 *
 * Order of preference:
 *   1. Supabase session (email OTP or anonymous sign-in).
 *   2. Guest cookie planted by middleware — used as in-memory progress key.
 *
 * Callers that need DB persistence should check `isAuthenticated`.
 */
export async function getCurrentUser(): Promise<CurrentUser> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        return {
          id: user.id,
          isAuthenticated: true,
          email: user.email ?? null,
          fullName:
            (user.user_metadata?.full_name as string | undefined) ?? null,
        };
      }
    } catch {
      // fall through to guest
    }
  }
  const jar = await cookies();
  const guest = jar.get(GUEST_COOKIE)?.value;
  return {
    id: guest ?? "demo-student",
    isAuthenticated: false,
  };
}
