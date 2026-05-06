"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { BOARDS, SUPPORTED_CLASSES } from "@/lib/curriculum/boards";
import { Spinner } from "@/components/ui/Spinner";

type Props = {
  initialBoardCode: string;
  initialClassLevel: number;
};

/**
 * When the learner switches board/class while deep inside a board-scoped
 * route like `/b/bse-od/c/9/s/mth/ch/.../t/...`, we can't just refresh — the
 * URL still says `c/9` so the page would re-render Class 9 content.
 *
 * Chapter/topic IDs are class-specific, so we send the user to `/today`
 * (which is fully ctx-aware) on any class/board change made from inside a
 * `/b/:slug/c/:n/...` route. From non-board routes (`/`, `/pricing`, etc.)
 * a refresh is enough since they only read context server-side.
 */
function isInsideBoardScopedRoute(pathname: string): boolean {
  return /^\/b\/[^/]+\/c\/[^/]+(\/.*)?$/.test(pathname);
}

export default function BoardClassSwitcher({
  initialBoardCode,
  initialClassLevel,
}: Props) {
  const router = useRouter();
  const pathname = usePathname() ?? "/";
  const [isPending, startTransition] = useTransition();
  const [boardCode, setBoardCode] = useState(initialBoardCode);
  const [classLevel, setClassLevel] = useState(initialClassLevel);
  const [error, setError] = useState<string | null>(null);

  const supportedClasses = SUPPORTED_CLASSES[boardCode] ?? [9];

  // The persist + reroute pair must happen inside a single transition so
  // React can keep `isPending` true across the network call AND the router
  // navigation. Otherwise the dropdown briefly returns to idle between the
  // POST and the navigation, and the user sees nothing happen.
  function persist(nextBoard: string, nextClass: number) {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/profile/context", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            boardCode: nextBoard,
            classLevel: nextClass,
          }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          setError(body.error ?? "failed");
          return;
        }
        if (isInsideBoardScopedRoute(pathname)) {
          router.replace("/today");
        } else {
          router.refresh();
        }
      } catch {
        setError("network");
      }
    });
  }

  return (
    <div
      className="flex items-center gap-2 text-xs text-slate-600"
      aria-busy={isPending}
    >
      <label className="flex items-center gap-1">
        <span className="sr-only">Board</span>
        <select
          value={boardCode}
          onChange={(e) => {
            const next = e.target.value;
            const defaultCls = (SUPPORTED_CLASSES[next] ?? [9])[0];
            setBoardCode(next);
            setClassLevel(defaultCls);
            void persist(next, defaultCls);
          }}
          className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-800 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
          aria-label="Board"
        >
          {BOARDS.map((b) => (
            <option key={b.code} value={b.code}>
              {b.shortLabel}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-1">
        <span className="sr-only">Class</span>
        <select
          value={classLevel}
          onChange={(e) => {
            const next = Number.parseInt(e.target.value, 10);
            setClassLevel(next);
            void persist(boardCode, next);
          }}
          className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-800 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
          aria-label="Class"
        >
          {supportedClasses.map((c) => (
            <option key={c} value={c}>
              Class {c}
            </option>
          ))}
        </select>
      </label>
      {isPending && (
        <span
          aria-live="polite"
          className="inline-flex items-center gap-1 text-[11px] text-slate-500"
        >
          <Spinner size="sm" />
          <span className="sr-only">Switching…</span>
        </span>
      )}
      {error && (
        <span
          role="alert"
          className="rounded bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-700"
        >
          {error}
        </span>
      )}
    </div>
  );
}
