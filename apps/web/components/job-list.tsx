"use client"

import { useTransition } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useSuspenseQuery } from "@apollo/client/react"
import { JOBS_QUERY } from "../lib/queries"
import { readFilters, toGraphqlFilter } from "../lib/filters"

export function JobList({ selectedId }: { selectedId: string | null }) {
  const sp = useSearchParams()
  const filter = toGraphqlFilter(readFilters(sp))
  const [isPending, startTransition] = useTransition()

  const { data, fetchMore } = useSuspenseQuery(JOBS_QUERY, {
    variables: { filter, first: 25 },
  })
  const { edges, pageInfo, totalCount } = data.jobs

  const hrefFor = (id: string) => {
    const p = new URLSearchParams(sp.toString())
    p.set("job", id)
    return `?${p.toString()}`
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        {totalCount.toLocaleString()} jobs
      </p>
      <ul className="space-y-1">
        {edges.map(({ node }) => (
          <li key={node.id}>
            <Link
              href={hrefFor(node.id)}
              replace
              scroll={false}
              className={`block rounded-md border p-3 text-sm hover:bg-muted ${
                node.id === selectedId ? "bg-muted" : ""
              }`}
            >
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
        ))}
      </ul>
      {pageInfo.hasNextPage && (
        <button
          disabled={isPending}
          // fetchMore suspends; running it in a transition keeps the list on screen
          onClick={() =>
            startTransition(async () => {
              await fetchMore({ variables: { after: pageInfo.endCursor } })
            })
          }
          className="w-full rounded-md border px-3 py-2 text-sm hover:bg-muted disabled:opacity-50"
        >
          {isPending ? "Loading…" : "Load more"}
        </button>
      )}
    </div>
  )
}
