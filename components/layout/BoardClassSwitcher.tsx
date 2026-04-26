"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { BOARDS, SUPPORTED_CLASSES } from "@/lib/curriculum/boards";

type Props = {
  initialBoardCode: string;
  initialClassLevel: number;
};

export default function BoardClassSwitcher({
  initialBoardCode,
  initialClassLevel,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [boardCode, setBoardCode] = useState(initialBoardCode);
  const [classLevel, setClassLevel] = useState(initialClassLevel);
  const [error, setError] = useState<string | null>(null);

  const supportedClasses = SUPPORTED_CLASSES[boardCode] ?? [9];

  async function persist(nextBoard: string, nextClass: number) {
    setError(null);
    try {
      const res = await fetch("/api/profile/context", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ boardCode: nextBoard, classLevel: nextClass }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        setError(body.error ?? "failed");
        return;
      }
      startTransition(() => router.refresh());
    } catch {
      setError("network");
    }
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
