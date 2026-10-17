"use client";

// Suspense queries throw on failure, so API errors land here.
export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto max-w-xl space-y-3 p-8">
      <h1 className="text-lg font-semibold">Couldn&apos;t load jobs</h1>
      <p className="text-sm text-muted-foreground">
        {error.message}. Is the API running? Start it with `make api`.
      </p>
      <button onClick={reset} className="rounded-md border px-3 py-2 text-sm hover:bg-muted">
        Try again
      </button>
    </main>
  );
}
