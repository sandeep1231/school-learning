export default function Loading() {
  return (
    <div
      className="container mx-auto flex min-h-[40vh] max-w-3xl flex-col items-center justify-center gap-3 px-4 py-16 text-slate-400"
      role="status"
      aria-live="polite"
    >
      <div
        className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-brand"
        aria-hidden="true"
      />
      <p className="text-sm">ଲୋଡ୍ ହେଉଛି…</p>
      <span className="sr-only">Loading</span>
    </div>
  );
}
