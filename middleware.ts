import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { ALL_TOPICS } from "@/lib/curriculum/bse-class9";
import { DEFAULT_BOARD_SLUG } from "@/lib/curriculum/boards";

// Default class for the static-curated topic index. Only used by the
// legacy /topic/:id middleware redirect for IDs that match the
// hardcoded `lib/curriculum/bse-class9.ts` baselines (MTH/SSC topics).
// DB-seeded topics fall through middleware and are resolved by the
// page itself via `resolveTopicPath` so the class is derived from the
// actual subject row rather than hardcoded.
const STATIC_TOPIC_CLASS = 9;

// Student flow (today/topic/chat/quiz) is open to guests — we still key
// progress to a per-browser guest cookie. Parent/teacher dashboards require
// real accounts because they expose aggregate data.
const PROTECTED_PREFIXES = ["/parent", "/teacher"];
const GUEST_COOKIE = "sikhya_guest_id";
const GUEST_MAX_AGE = 60 * 60 * 24 * 365;

// Phase 1: legacy /topic/:topicId → new /b/.../ch/.../t/... hub. Done in
// middleware (not the page) because the page has a loading.tsx that forces
// streaming, after which in-component redirect() can't produce a 307.
// Phase 2 adds /topic/:topicId/practice → board-scoped practice for the
// same reason (loading.tsx under practice/).
const TOPIC_INDEX = new Map(
  ALL_TOPICS.map((t) => [
    t.id,
    { subject: t.subjectCode.toLowerCase(), chapter: t.chapterSlug },
  ]),
);
const TOPIC_BASE_RE = /^\/topic\/([^/]+)\/?$/;
const TOPIC_PRACTICE_RE = /^\/topic\/([^/]+)\/practice\/?$/;
const TOPIC_LEARN_RE = /^\/topic\/([^/]+)\/learn\/?$/;

function newGuestId() {
  return (
    "g_" +
    Math.random().toString(36).slice(2, 10) +
    Math.random().toString(36).slice(2, 10)
  );
}

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request });

  // Legacy /topic/:id → board-scoped URL. Only the base route (not the
  // /learn, /practice, /master sub-routes, which keep their legacy path
  // until Phase 2/3).
  const topicMatch = TOPIC_BASE_RE.exec(request.nextUrl.pathname);
  if (topicMatch) {
    const entry = TOPIC_INDEX.get(topicMatch[1]);
    if (entry) {
      const url = request.nextUrl.clone();
      url.pathname = `/b/${DEFAULT_BOARD_SLUG}/c/${STATIC_TOPIC_CLASS}/s/${entry.subject}/ch/${entry.chapter}/t/${topicMatch[1]}`;
      return NextResponse.redirect(url, 307);
    }
  }

  // Phase 2: legacy /topic/:id/practice → board-scoped practice.
  const practiceMatch = TOPIC_PRACTICE_RE.exec(request.nextUrl.pathname);
  if (practiceMatch) {
    const entry = TOPIC_INDEX.get(practiceMatch[1]);
    if (entry) {
      const url = request.nextUrl.clone();
      url.pathname = `/b/${DEFAULT_BOARD_SLUG}/c/${STATIC_TOPIC_CLASS}/s/${entry.subject}/ch/${entry.chapter}/t/${practiceMatch[1]}/practice`;
      return NextResponse.redirect(url, 307);
    }
  }

  // Phase 3: legacy /topic/:id/learn → board-scoped learn.
  const learnMatch = TOPIC_LEARN_RE.exec(request.nextUrl.pathname);
  if (learnMatch) {
    const entry = TOPIC_INDEX.get(learnMatch[1]);
    if (entry) {
      const url = request.nextUrl.clone();
      url.pathname = `/b/${DEFAULT_BOARD_SLUG}/c/${STATIC_TOPIC_CLASS}/s/${entry.subject}/ch/${entry.chapter}/t/${learnMatch[1]}/learn`;
      return NextResponse.redirect(url, 307);
    }
  }

  if (!request.cookies.get(GUEST_COOKIE)) {
    const id = newGuestId();
    request.cookies.set(GUEST_COOKIE, id);
    response.cookies.set(GUEST_COOKIE, id, {
      path: "/",
      maxAge: GUEST_MAX_AGE,
      sameSite: "lax",
    });
  }

  // Skip the Supabase auth round-trip for public student/guest routes —
  // /today, /b/..., /topic/..., /chat/..., etc. don't depend on the user
  // object, so paying ~50-150ms per render to learn that was a 95% waste.
  // Only protected prefixes (parent/teacher dashboards) need a session.
  const needsAuth = PROTECTED_PREFIXES.some((p) =>
    request.nextUrl.pathname.startsWith(p),
  );
  if (!needsAuth) return response;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return response;

  type CookieToSet = {
    name: string;
    value: string;
    options?: Parameters<typeof response.cookies.set>[2];
  };

  const supabase = createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet: CookieToSet[]) => {
          toSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/sign-in";
    url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/cron|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
