"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { BoardBar } from "./board-bar";
import { Filters } from "./filters";
import { JobDetail } from "./job-detail";
import { JobList } from "./job-list";

const loading = <p className="text-sm text-muted-foreground">Loading…</p>;

export function Feed() {
  const selected = useSearchParams().get("job");

  return (
    <div className="mx-auto flex h-svh max-w-7xl flex-col gap-3 p-4">
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">jobhunter</h1>
        <nav className="flex gap-4 text-sm">
          <Link href="/boards" className="underline">
            Boards
          </Link>
          <Link href="/profile" className="underline">
            Profile
          </Link>
        </nav>
      </header>
      <Suspense fallback={null}>
        <BoardBar />
      </Suspense>
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 md:grid-cols-[26rem_1fr]">
        <section className="min-h-0 space-y-4 overflow-y-auto">
          <Suspense fallback={null}>
            <Filters />
          </Suspense>
          <Suspense fallback={loading}>
            <JobList selectedId={selected} />
          </Suspense>
        </section>
        <section className="min-h-0 overflow-y-auto rounded-md border p-4">
          <Suspense fallback={loading}>
            <JobDetail id={selected} />
          </Suspense>
        </section>
      </div>
    </div>
  );
}
