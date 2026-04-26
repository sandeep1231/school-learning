"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const STORAGE_KEY = "sikhya.today.welcome.dismissed";

export default function WelcomeBanner({
  firstTopicId,
  firstTopicTitleOr,
  firstTopicTitleEn,
}: {
  firstTopicId: string;
  firstTopicTitleOr: string;
  firstTopicTitleEn: string;
}) {
  const [dismissed, setDismissed] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      setDismissed(false);
    }
  }, []);

  if (dismissed !== false) return null;

  return (
    <div
      role="status"
      className="mb-4 flex flex-wrap items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
    >
      <div className="flex-1">
        <div className="font-semibold">ସ୍ୱାଗତ! · Welcome to Sikhya</div>
        <p className="mt-0.5 text-amber-800">
          Jump into your first lesson or ask the tutor a question about any
          subject — every answer cites the BSE textbook.
        </p>
      </div>
      <Link
        href={`/topic/${firstTopicId}`}
        className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
      >
        Start: {firstTopicTitleEn}
      </Link>
      <button
        type="button"
        onClick={() => {
          try {
            localStorage.setItem(STORAGE_KEY, "1");
          } catch {
            /* ignore */
          }
          setDismissed(true);
        }}
        className="rounded-md px-2 py-1 text-xs text-amber-700 hover:bg-amber-100"
        aria-label="Dismiss welcome banner"
      >
        ✕
      </button>
      <span className="sr-only">First topic in Odia: {firstTopicTitleOr}</span>
    </div>
  );
}
