"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useSuspenseQuery } from "@apollo/client/react";
import { JOBS_QUERY } from "../lib/queries";
import { toGraphqlFilter } from "../lib/filters";
import { useFeedFilters } from "../lib/use-feed-filters";

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

export function JobList() {
  const { filters } = useFeedFilters();
  const filter = toGraphqlFilter(filters);
  const [isPending, startTransition] = useTransition();

  // Headers depend on the browser's clock and timezone, so add them after mount.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const { data, fetchMore } = useSuspenseQuery(JOBS_QUERY, {
    variables: { filter, first: 25 },
  });
  const { edges, pageInfo, totalCount } = data.jobs;

  let lastBucket = "";
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">{totalCount.toLocaleString()} jobs</p>
      <ul className="space-y-1">
        {edges.map(({ node }) => {
          const b = mounted ? bucket(node.firstSeenAt) : "";
          const header = b && b !== lastBucket ? b : null;
          if (b) lastBucket = b;
          return (
            <li key={node.id}>
              {header && (
                <div className="flex items-center gap-2 pb-1 pt-3 text-xs text-muted-foreground">
                  <span>{header}</span>
                  <span className="h-px flex-1 bg-border" />
                </div>
              )}
              <Link href={`/${node.id}`} className="block rounded-md border p-3 text-sm hover:bg-muted">
                <div className="font-medium">{node.title}</div>
                <div className="text-muted-foreground">
                  {node.companyName}
                  {node.location ? ` · ${node.location}` : ""}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {node.remoteType.toLowerCase()} · via {node.source}
                  {node.boardSize != null
                    ? ` · ${node.companyName} has ${node.boardSize} ${node.boardSize === 1 ? "listing" : "listings"}`
                    : ""}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
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
