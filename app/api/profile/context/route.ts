import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import {
  BOARDS,
  isClassSupported,
  SUPPORTED_CLASSES,
} from "@/lib/curriculum/boards";
import { PROFILE_COOKIE } from "@/lib/auth/context";

// POST /api/profile/context
// Body: { boardCode: string; classLevel: number }
// Persists to profiles row if authenticated, else sets a cookie. Used by
// the BoardClassSwitcher header widget.
export async function POST(req: Request) {
  let body: { boardCode?: unknown; classLevel?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const boardCode = typeof body.boardCode === "string" ? body.boardCode : null;
  const classLevel =
    typeof body.classLevel === "number" && Number.isFinite(body.classLevel)
      ? body.classLevel
      : null;

  if (!boardCode || !classLevel) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }
  if (!BOARDS.some((b) => b.code === boardCode)) {
    return NextResponse.json({ error: "unknown_board" }, { status: 400 });
  }
  if (!isClassSupported(boardCode, classLevel)) {
    return NextResponse.json(
      {
        error: "unsupported_class",
        supported: SUPPORTED_CLASSES[boardCode] ?? [],
      },
      { status: 400 },
    );
  }

  // Always set the cookie so middleware / guests see the change immediately.
  const jar = await cookies();
  jar.set(PROFILE_COOKIE, `${boardCode}:${classLevel}`, {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { error } = await supabase
          .from("profiles")
          .update({ board: boardCode, class_level: classLevel })
          .eq("id", user.id);
        if (error) {
          return NextResponse.json(
            { error: "persist_failed", detail: error.message },
            { status: 500 },
          );
        }
        return NextResponse.json({ ok: true, persisted: true });
      }
    } catch {
      // ignore, cookie fallback already set
    }
  }

  return NextResponse.json({ ok: true, persisted: false });
}
