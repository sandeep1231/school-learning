/**
 * Phase 14 — offline fallback page shown by the service worker when a
 * navigation request can't reach the network and nothing is cached.
 */
export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 py-12 text-center">
      <div className="text-5xl">📡</div>
      <h1 className="mt-6 text-2xl font-semibold">You're offline</h1>
      <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-300">
        This page hasn't been opened before, so we can't show it without an
        internet connection. Head back to a page you've already visited, or
        reconnect and try again.
      </p>
      <a
        href="/today"
        className="mt-6 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
      >
        Go to today
      </a>
    </main>
  );
}
