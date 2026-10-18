"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Filters } from "./filters";
import { JobList } from "./job-list";
import { JobDetail } from "./job-detail";

const loading = <p className="text-sm text-muted-foreground">Loading…</p>;

export function Feed() {
  const selected = useSearchParams().get("job");

  return (
    <main className="mx-auto grid h-svh max-w-7xl grid-cols-1 gap-6 p-4 md:grid-cols-[26rem_1fr]">
      <section className="space-y-4 overflow-y-auto">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold">jobhunter</h1>
          <Link href="/profile" className="text-sm underline">
            Profile
          </Link>
        </div>
        <Filters />
        <Suspense fallback={loading}>
          <JobList selectedId={selected} />
        </Suspense>
      </section>
      <section className="overflow-y-auto rounded-md border p-4">
        <Suspense fallback={loading}>
          <JobDetail id={selected} />
        </Suspense>
      </section>
    </main>
  );
}
