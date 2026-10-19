"use client";

import { Suspense } from "react";
import Link from "next/link";
import { BoardBar } from "./board-bar";
import { JobList } from "./job-list";

const loading = <p className="text-sm text-muted-foreground">Loading…</p>;

export function Feed() {
  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">jobhunter</h1>
        <nav className="flex gap-4 text-sm">
          <Link href="/applications" className="underline">
            Applications
          </Link>
          <Link href="/boards" className="underline">
            Boards
          </Link>
          <Link href="/memory" className="underline">
            Memory
          </Link>
          <Link href="/profile" className="underline">
            Profile
          </Link>
        </nav>
      </header>
      <div className="sticky top-0 z-10 -mx-4 border-b bg-background px-4 py-2">
        <Suspense fallback={null}>
          <BoardBar />
        </Suspense>
      </div>
      <Suspense fallback={loading}>
        <JobList />
      </Suspense>
    </div>
  );
}
