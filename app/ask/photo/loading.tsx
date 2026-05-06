import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <main className="container mx-auto max-w-2xl px-4 py-6">
      <Skeleton className="h-7 w-64" />
      <Skeleton className="mt-2 h-4 w-3/4" />
      <Skeleton className="mt-6 h-44 w-full rounded-xl" />
    </main>
  );
}
