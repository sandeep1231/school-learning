"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AUDIENCE_COOKIE, type AudienceVariant } from "@/lib/learn/audience";

export type { AudienceVariant } from "@/lib/learn/audience";
export { AUDIENCE_COOKIE } from "@/lib/learn/audience";

const LABELS: Record<AudienceVariant, { en: string; or: string }> = {
  textbook: { en: "Textbook", or: "ପାଠ୍ଯପୁସ୍ତକ" },
  simpler: { en: "Simpler", or: "ସହଜ" },
  parent: { en: "For Parents", or: "ପିତାମାତାଙ୍କ ପାଇଁ" },
  exam: { en: "Exam Focus", or: "ପରୀକ୍ଷା କେନ୍ଦ୍ରିତ" },
};

function readCookie(): AudienceVariant | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(
    new RegExp(`(?:^|; )${AUDIENCE_COOKIE}=([^;]+)`),
  );
  if (!m) return null;
  const v = decodeURIComponent(m[1]);
  return v === "textbook" || v === "simpler" || v === "parent" || v === "exam"
    ? v
    : null;
}

function writeCookie(v: AudienceVariant) {
  const oneYear = 60 * 60 * 24 * 365;
  document.cookie = `${AUDIENCE_COOKIE}=${v}; Path=/; Max-Age=${oneYear}; SameSite=Lax`;
}

type Props = {
  current: AudienceVariant;
  available: AudienceVariant[];
};

export default function AudienceToggle({ current, available }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [value, setValue] = useState<AudienceVariant>(current);

  // If the server rendered with `current` different from the cookie (e.g. on
  // first visit when no cookie existed yet), reconcile the local state. We
  // don't trigger a reload here — the server will pick it up on next nav.
  useEffect(() => {
    const c = readCookie();
    if (c && c !== current && available.includes(c)) {
      setValue(c);
    }
  }, [current, available]);

  function select(v: AudienceVariant) {
    if (v === value) return;
    setValue(v);
    writeCookie(v);
    startTransition(() => router.refresh());
  }

  return (
    <div
      role="radiogroup"
      aria-label="Lesson audience"
      className="inline-flex flex-wrap items-center gap-1 rounded-lg border border-slate-200 bg-white p-1 text-sm shadow-sm"
    >
      {(["textbook", "simpler", "parent", "exam"] as AudienceVariant[]).map((v) => {
        const disabled = !available.includes(v);
        const active = v === value;
        return (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={active}
            aria-disabled={disabled}
            disabled={disabled || isPending}
            onClick={() => !disabled && select(v)}
            className={
              "rounded-md px-3 py-1.5 transition " +
              (active
                ? "bg-brand text-white shadow"
                : disabled
                  ? "text-slate-400"
                  : "text-slate-700 hover:bg-slate-100")
            }
            title={disabled ? "Not available yet for this topic" : undefined}
          >
            <span className="font-medium">{LABELS[v].or}</span>
            <span className="ml-1 text-xs opacity-80">({LABELS[v].en})</span>
          </button>
        );
      })}
    </div>
  );
}
