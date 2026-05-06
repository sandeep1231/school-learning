import { cache } from "react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import {
  DEFAULT_BOARD_CODE,
  DEFAULT_CLASS_LEVEL,
  boardCodeToSlug,
} from "@/lib/curriculum/boards";

export const PROFILE_COOKIE = "sikhya_bc"; // {board}:{classLevel}

export type UserContext = {
  boardCode: string;
  boardSlug: string;
  classLevel: number;
  /** true if the value came from a real profiles row (auth user). */
  persisted: boolean;
};

/**
 * Resolve the current user's (board, classLevel).
 *
 * Preference order:
 *   1. profiles row (authenticated users) — authoritative.
 *   2. `sikhya_bc` cookie (guests who picked in the switcher).
 *   3. Platform defaults (BSE_ODISHA / 9).
 *
 * Callers are server-only; importing from a client component is a bug.
 */
export const getUserContext = cache(async function getUserContext(): Promise<UserContext> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("board, class_level")
          .eq("id", user.id)
          .maybeSingle();
        if (profile?.board && profile.class_level) {
          return {
            boardCode: profile.board,
            boardSlug: boardCodeToSlug(profile.board),
            classLevel: profile.class_level,
            persisted: true,
          };
        }
      }
    } catch {
      // fall through
    }
  }

  const jar = await cookies();
  const raw = jar.get(PROFILE_COOKIE)?.value;
  if (raw) {
    const [board, cls] = raw.split(":");
    const classLevel = Number.parseInt(cls ?? "", 10);
    if (board && Number.isFinite(classLevel)) {
      return {
        boardCode: board,
        boardSlug: boardCodeToSlug(board),
        classLevel,
        persisted: false,
      };
    }
  }

  return {
    boardCode: DEFAULT_BOARD_CODE,
    boardSlug: boardCodeToSlug(DEFAULT_BOARD_CODE),
    classLevel: DEFAULT_CLASS_LEVEL,
    persisted: false,
  };
});
