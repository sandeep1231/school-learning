import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <main className="container mx-auto max-w-3xl px-4 py-8">
      <Skeleton className="h-3 w-32" />
      <Skeleton className="mt-2 h-7 w-2/3" />
      <Skeleton className="mt-1 h-4 w-1/3" />
      <div className="mt-6 space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-slate-200 bg-white p-4"
          >
            <Skeleton className="h-4 w-3/4" />
            <div className="mt-3 space-y-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
