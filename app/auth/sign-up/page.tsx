import type { Metadata } from "next";
import SignUpClient from "./SignUpClient";

export const metadata: Metadata = {
  title: "Create account",
  description: "Sign up for Sikhya Sathi.",
};

export default function SignUpPage() {
  return (
    <main className="container mx-auto max-w-sm px-4 py-12">
      <h1 className="mb-2 text-2xl font-bold text-brand-900">Create account</h1>
      <p className="mb-6 text-sm text-slate-600">
        Tell us a little about yourself. We&rsquo;ll send a code to your email
        to confirm.
      </p>
      <SignUpClient />
    </main>
  );
}
