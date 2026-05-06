import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <main className="container mx-auto max-w-3xl px-4 py-8">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-2 h-8 w-2/3" />
      <Skeleton className="mt-1 h-4 w-1/3" />
      <Skeleton className="mt-6 h-28 w-full rounded-lg" />
      <div className="mt-6 space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-xl" />
        ))}
      </div>
    </main>
  );
}
