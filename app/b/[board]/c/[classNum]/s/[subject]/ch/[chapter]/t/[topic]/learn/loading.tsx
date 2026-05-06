import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <main className="container mx-auto max-w-3xl px-4 py-8">
      <Skeleton className="h-3 w-32" />
      <Skeleton className="mt-2 h-7 w-2/3" />
      <Skeleton className="mt-1 h-4 w-1/3" />
      <div className="mt-6 space-y-3">
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-6 w-11/12" />
        <Skeleton className="h-6 w-10/12" />
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-6 w-9/12" />
      </div>
    </main>
  );
}
