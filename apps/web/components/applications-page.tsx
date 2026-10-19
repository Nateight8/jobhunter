"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useQuery, useSuspenseQuery } from "@apollo/client/react";
import { APPLICATION_COUNTS_QUERY, APPLICATIONS_QUERY } from "../lib/application-queries";
import type { ApplicationStatus } from "../lib/gql/graphql";
import { useApplicationActions } from "../lib/use-application-actions";
import { STATUS_LABEL } from "./job-list";

const TABS: ApplicationStatus[] = ["APPLIED", "INTERVIEWING", "OFFER", "REJECTED", "SAVED", "HIDDEN"];
const btn = "rounded-md border px-2 py-1 text-xs hover:bg-muted";

function ApplicationList({ status }: { status: ApplicationStatus }) {
  const { data } = useSuspenseQuery(APPLICATIONS_QUERY, { variables: { status } });
  const { setStatus, remove, setNotes } = useApplicationActions(true);
  const [error, setError] = useState<string | null>(null);

  const run = (fn: () => Promise<unknown>) => {
    setError(null);
    fn().catch((e: unknown) => setError(e instanceof Error ? e.message : "Something went wrong"));
  };

  if (data.applications.length === 0) {
    return <p className="text-sm text-muted-foreground">Nothing here yet.</p>;
  }

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-destructive">{error}</p>}
      <ul className="space-y-3">
        {data.applications.map((a) => (
          <li key={a.id} className="space-y-2 rounded-md border p-3 text-sm">
            <div>
              <Link href={`/${a.job.id}`} className="font-medium underline">
                {a.job.title}
              </Link>
              <div className="text-muted-foreground">
                {a.job.companyName}
                {a.job.location ? ` · ${a.job.location}` : ""}
                {a.appliedAt ? ` · applied ${new Date(a.appliedAt).toISOString().slice(0, 10)}` : ""}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={a.status}
                onChange={(e) => run(() => setStatus(a.job.id, e.target.value as ApplicationStatus))}
                className="rounded-md border bg-background px-2 py-1 text-xs"
              >
                {TABS.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
              <a href={a.job.applyUrl ?? a.job.url} target="_blank" rel="noopener noreferrer" className={btn}>
                Open posting
              </a>
              <button
                type="button"
                className={btn}
                onClick={() => {
                  if (a.status === "SAVED" || a.status === "HIDDEN" || window.confirm("Remove this from your tracker?")) {
                    run(() => remove(a.job.id));
                  }
                }}
              >
                Remove
              </button>
            </div>
            <textarea
              key={`${a.id}-${a.updatedAt}`}
              defaultValue={a.notes ?? ""}
              rows={2}
              placeholder="Notes"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              onBlur={(e) => {
                if (e.target.value !== (a.notes ?? "")) run(() => setNotes(a.job.id, e.target.value));
              }}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ApplicationsPage() {
  const [status, setStatus] = useState<ApplicationStatus>("APPLIED");
  const { data: counts } = useQuery(APPLICATION_COUNTS_QUERY);
  const countOf = (s: ApplicationStatus) => counts?.applicationCounts.find((c) => c.status === s)?.count ?? 0;

  return (
    <main className="mx-auto max-w-3xl space-y-4 p-4">
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Applications</h1>
        <Link href="/" className="text-sm underline">
          Back to jobs
        </Link>
      </header>
      <nav className="flex flex-wrap gap-2">
        {TABS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatus(s)}
            className={`rounded-md border px-3 py-1.5 text-sm ${s === status ? "bg-muted font-medium" : "hover:bg-muted"}`}
          >
            {STATUS_LABEL[s]} <span className="text-muted-foreground">{countOf(s)}</span>
          </button>
        ))}
      </nav>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
        <ApplicationList key={status} status={status} />
      </Suspense>
    </main>
  );
}
