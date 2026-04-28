import Link from "next/link";
import { getUserContext } from "@/lib/auth/context";
import { getCurrentUser } from "@/lib/auth/user";
import { getStreakInfo } from "@/lib/progress.rollup";
import { tierLabel } from "@/lib/billing/tiers";
import BoardClassSwitcher from "./BoardClassSwitcher";
import ThemeToggle from "@/components/theme/ThemeToggle";
import UserMenu from "./UserMenu";

/**
 * Global application header — mounted once in app/layout.tsx.
 *
 * Server component that reads the current user's board/class so the
 * client-side switcher hydrates with the right initial value.
 */
export default async function Header() {
  const [ctx, user] = await Promise.all([getUserContext(), getCurrentUser()]);
  const streak = await getStreakInfo(user);
  const isParent = user.role === "parent" || user.role === "teacher";

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
      <div className="container mx-auto flex h-12 max-w-5xl items-center gap-4 px-4">
        <Link
          href="/today"
          className="text-sm font-bold tracking-tight text-brand-900 hover:text-brand"
          aria-label="Sikhya Sathi home"
        >
          Sikhya Sathi
        </Link>
        {streak.current > 0 && (
          <span
            aria-label={`${streak.current}-day streak`}
            title={`Longest: ${streak.longest} day${streak.longest === 1 ? "" : "s"}`}
            className="hidden rounded-full bg-amber-200 px-2 py-0.5 text-xs font-semibold text-amber-950 sm:inline-block"
          >
            🔥 {streak.current}
          </span>
        )}
        <nav aria-label="Primary" className="ml-auto flex items-center gap-3">
          <Link
            href="/review"
            className="hidden text-xs font-medium text-slate-600 hover:text-brand sm:inline-block"
          >
            Review
          </Link>
          <Link
            href="/pricing"
            className="hidden text-xs font-medium text-slate-600 hover:text-brand sm:inline-block"
          >
            Pricing
          </Link>
          <BoardClassSwitcher
            initialBoardCode={ctx.boardCode}
            initialClassLevel={ctx.classLevel}
          />
          <ThemeToggle />
          {user.isAuthenticated ? (
            <UserMenu
              email={user.email ?? null}
              fullName={user.fullName ?? null}
              tierLabel={tierLabel(user.subscription)}
              tierStatus={user.subscription.status}
              isParent={isParent}
            />
          ) : (
            <div className="flex items-center gap-1">
              <Link
                href="/auth/sign-in"
                className="rounded-md px-2 py-1 text-xs font-semibold text-slate-700 hover:text-brand dark:text-slate-200"
              >
                Sign in
              </Link>
              <Link
                href="/auth/sign-up"
                className="rounded-md bg-brand px-2 py-1 text-xs font-semibold text-white hover:bg-brand-700"
              >
                Sign up
              </Link>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}
