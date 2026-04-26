import { Spinner } from "@/components/ui/Spinner";

export default function Loading() {
  return (
    <main className="container mx-auto flex h-[calc(100vh-4rem)] max-w-3xl flex-col items-center justify-center gap-3 px-4 py-6 text-slate-500">
      <Spinner size="lg" />
      <p className="text-sm">Opening chat…</p>
    </main>
  );
}
