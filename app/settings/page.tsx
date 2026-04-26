import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/user";
import SettingsClient from "./SettingsClient";

export const metadata: Metadata = {
  title: "Settings",
  description: "Manage your Sikhya Sathi account, privacy, and data.",
};

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user.isAuthenticated) {
    redirect("/auth/sign-in?next=/settings");
  }
  return (
    <main className="container mx-auto max-w-2xl px-6 py-10">
      <h1 className="text-2xl font-bold tracking-tight text-brand-900">
        Settings
      </h1>
      <p className="mt-2 text-sm text-slate-600">
        Manage your account, privacy preferences, and data.
      </p>
      <SettingsClient email={user.email ?? null} />
    </main>
  );
}
