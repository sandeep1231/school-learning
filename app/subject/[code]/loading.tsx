import { Spinner } from "@/components/ui/Spinner";

export default function Loading() {
  return (
    <main className="container mx-auto flex h-[calc(100vh-4rem)] max-w-3xl flex-col px-4 py-6">
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-slate-500">
        <Spinner size="lg" />
        <p className="text-sm">Loading subject…</p>
      </div>
    </main>
  );
}
