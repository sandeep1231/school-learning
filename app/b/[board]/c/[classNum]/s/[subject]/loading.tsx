import { Skeleton, SkeletonCard } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <main className="container mx-auto max-w-5xl px-4 py-6">
      <Skeleton className="h-3 w-16" />
      <header className="mt-2 mb-4">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="mt-1 h-4 w-64" />
      </header>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <Skeleton className="h-[28rem] w-full rounded-xl" />
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    </main>
  );
}
