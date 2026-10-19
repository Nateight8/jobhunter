"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useSuspenseQuery } from "@apollo/client/react";
import { JOBS_QUERY } from "../lib/queries";
import { toGraphqlFilter } from "../lib/filters";
import type { ApplicationStatus } from "../lib/gql/graphql";
import { useApplicationActions } from "../lib/use-application-actions";
import { useFeedFilters } from "../lib/use-feed-filters";

export const STATUS_LABEL: Record<ApplicationStatus, string> = {
  SAVED: "Saved",
  APPLIED: "Applied",
  INTERVIEWING: "Interviewing",
  OFFER: "Offer",
  REJECTED: "Rejected",
  HIDDEN: "Hidden",
};

// Timeline buckets by first-seen day, in the browser's timezone.
function bucket(iso: string): string {
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOfDay(new Date()) - startOfDay(new Date(iso))) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return "This week";
  if (days < 14) return "Last week";
  return "Earlier";
}

const act = "rounded-md border px-2 py-1 text-xs hover:bg-muted";

export function JobList() {
  const { filters } = useFeedFilters();
  const sp = useSearchParams();
  const tracked = sp.get("tracked") === "1";
  const filter = { ...toGraphqlFilter(filters), includeTracked: tracked || undefined };
  const [isPending, startTransition] = useTransition();
  const { setStatus, remove } = useApplicationActions();
  const [error, setError] = useState<string | null>(null);

  // Headers depend on the browser's clock and timezone, so add them after mount.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const { data, fetchMore } = useSuspenseQuery(JOBS_QUERY, {
    variables: { filter, first: 25 },
  });
  const { edges, pageInfo, totalCount } = data.jobs;

  const trackedHref = (() => {
    const p = new URLSearchParams(sp.toString());
    if (tracked) p.delete("tracked");
    else p.set("tracked", "1");
    return `?${p.toString()}`;
  })();

  const run = (fn: () => Promise<unknown>) => {
    setError(null);
    fn().catch((e: unknown) => setError(e instanceof Error ? e.message : "Something went wrong"));
  };

  let lastBucket = "";
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
        <span>{totalCount.toLocaleString()} jobs</span>
        <Link href={trackedHref} replace scroll={false} className="underline">
          {tracked ? "Hide applied and hidden jobs" : "Show jobs I've applied to or hidden"}
        </Link>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <ul className="space-y-1">
        {edges.map(({ node }) => {
          const b = mounted ? bucket(node.firstSeenAt) : "";
          const header = b && b !== lastBucket ? b : null;
          if (b) lastBucket = b;
          const status = node.applicationStatus;
          return (
            <li key={node.id}>
              {header && (
                <div className="flex items-center gap-2 pb-1 pt-3 text-xs text-muted-foreground">
                  <span>{header}</span>
                  <span className="h-px flex-1 bg-border" />
                </div>
              )}
              <div className="rounded-md border p-3 text-sm">
                <Link href={`/${node.id}`} className="block space-y-1 hover:opacity-80">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-medium">{node.title}</span>
                    {status && (
                      <span className="shrink-0 rounded border px-1.5 py-0.5 text-xs text-muted-foreground">
                        {STATUS_LABEL[status]}
                      </span>
                    )}
                  </div>
                  <div className="text-muted-foreground">
                    {node.companyName}
                    {node.location ? ` · ${node.location}` : ""}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {node.remoteType.toLowerCase()} · via {node.source}
                    {node.boardSize != null
                      ? ` · ${node.companyName} has ${node.boardSize} ${node.boardSize === 1 ? "listing" : "listings"}`
                      : ""}
                  </div>
                </Link>
                <div className="mt-2 flex gap-2">
                  {status === null && (
                    <>
                      <button type="button" className={act} onClick={() => run(() => setStatus(node.id, "SAVED"))}>
                        Save
                      </button>
                      <button
                        type="button"
                        className={act}
                        onClick={() => run(() => setStatus(node.id, "HIDDEN", { evict: !tracked }))}
                      >
                        Not interested
                      </button>
                    </>
                  )}
                  {status === "SAVED" && (
                    <>
                      <button type="button" className={act} onClick={() => run(() => remove(node.id))}>
                        Unsave
                      </button>
                      <button
                        type="button"
                        className={act}
                        onClick={() => run(() => setStatus(node.id, "HIDDEN", { evict: !tracked }))}
                      >
                        Not interested
                      </button>
                    </>
                  )}
                  {status === "HIDDEN" && (
                    <button type="button" className={act} onClick={() => run(() => remove(node.id))}>
                      Restore
                    </button>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      {edges.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No jobs match this board. Edit its filters, or pick another board.
        </p>
      )}
      {pageInfo.hasNextPage && (
        <button
          disabled={isPending}
          // fetchMore suspends; running it in a transition keeps the list on screen
          onClick={() =>
            startTransition(async () => {
              await fetchMore({ variables: { after: pageInfo.endCursor } });
            })
          }
          className="w-full rounded-md border px-3 py-2 text-sm hover:bg-muted disabled:opacity-50"
        >
          {isPending ? "Loading…" : "Load more"}
        </button>
      )}
    </div>
  );
}
