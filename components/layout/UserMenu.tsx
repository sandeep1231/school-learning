"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Props = {
  email: string | null;
  fullName: string | null;
  tierLabel: string;
  tierStatus: "free" | "active" | "expiring" | "expired";
  isParent: boolean;
};

const STATUS_CLASSES: Record<Props["tierStatus"], string> = {
  free: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
  active:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  expiring:
    "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100",
  expired: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
};

/**
 * User dropdown shown in the global header for authenticated users.
 * Trigger: avatar circle + tier pill. Menu: identity, profile/settings
 * links, parent dashboard (when role=parent), sign out.
 */
export default function UserMenu({
  email,
  fullName,
  tierLabel,
  tierStatus,
  isParent,
}: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const display = fullName?.trim() || email?.split("@")[0] || "Account";
  const initial = (display[0] ?? "?").toUpperCase();

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function signOut() {
    setBusy(true);
    try {
      await fetch("/api/auth/sign-out", { method: "POST" });
    } catch {
      /* ignore */
    }
    // Force a full reload so server components re-evaluate auth state.
    window.location.href = "/";
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full border border-slate-200 bg-white py-0.5 pl-0.5 pr-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
      >
        <span
          aria-hidden
          className="flex h-6 w-6 items-center justify-center rounded-full bg-brand text-[11px] font-bold text-white"
        >
          {initial}
        </span>
        <span className="hidden max-w-[8rem] truncate sm:inline">
          {display}
        </span>
        <span
          className={`hidden rounded-full px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide sm:inline ${STATUS_CLASSES[tierStatus]}`}
        >
          {tierLabel}
        </span>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-40 mt-2 w-60 rounded-lg border border-slate-200 bg-white py-1 text-sm shadow-lg dark:border-slate-700 dark:bg-slate-900"
        >
          <div className="border-b border-slate-100 px-3 py-2 dark:border-slate-800">
            <p className="truncate font-medium text-slate-900 dark:text-slate-100">
              {display}
            </p>
            {email && (
              <p className="truncate text-xs text-slate-500">{email}</p>
            )}
            <p className="mt-1 text-[11px] uppercase tracking-wide text-slate-400">
              {tierLabel} plan
            </p>
          </div>
          <Link
            href="/profile"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="block px-3 py-2 text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Your profile
          </Link>
          <Link
            href="/settings"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="block px-3 py-2 text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Settings
          </Link>
          {isParent && (
            <Link
              href="/parent"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="block px-3 py-2 text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Parent dashboard
            </Link>
          )}
          <Link
            href="/pricing"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="block px-3 py-2 text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Plans &amp; billing
          </Link>
          <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
          <button
            type="button"
            role="menuitem"
            onClick={signOut}
            disabled={busy}
            className="block w-full px-3 py-2 text-left text-red-600 hover:bg-red-50 disabled:opacity-50 dark:text-red-300 dark:hover:bg-red-900/30"
          >
            {busy ? "Signing out…" : "Sign out"}
          </button>
        </div>
      )}
    </div>
  );
}
