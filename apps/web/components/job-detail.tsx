"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useSuspenseQuery } from "@apollo/client/react"
import { JOB_QUERY } from "../lib/queries"
import { sanitizeHtml } from "../lib/sanitize"
import { ApplicationForm } from "./application-form"

import { ApplyPanel } from "./apply-panel"

export function BackButton() {
  const router = useRouter()
  return (
    <button
      type="button"
      className="text-sm underline"
      // back keeps the list's filters and scroll position; fall back to the feed for a fresh tab
      onClick={() =>
        window.history.length > 1 ? router.back() : router.push("/")
      }
    >
      ← Back to jobs
    </button>
  )
}

export function JobDetail({ id }: { id: string }) {
  const { data } = useSuspenseQuery(JOB_QUERY, { variables: { id } })
  const job = data.job

  // Sanitizing needs the DOM, so render the description only after mount.
  // This keeps the server and first client render identical (no hydration mismatch).
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const html = useMemo(
    () => (mounted ? sanitizeHtml(job?.description ?? "") : ""),
    [mounted, job?.description]
  )

  if (!job)
    return <p className="text-sm text-muted-foreground">Job not found.</p>

  return (
    <article className="space-y-4">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">{job.title}</h1>
        <p className="text-sm text-muted-foreground">
          {job.companyName}
          {job.location ? ` · ${job.location}` : ""} ·{" "}
          {job.remoteType.toLowerCase()}
        </p>
        <p className="text-xs text-muted-foreground">
          First seen {new Date(job.firstSeenAt).toISOString().slice(0, 10)} ·
          via{" "}
          <a
            href={job.url}
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            {job.source}
          </a>
        </p>
        {job.closedAt && (
          <p className="rounded-md border p-3 text-sm">
            This listing is no longer on the source board (closed{" "}
            {new Date(job.closedAt).toISOString().slice(0, 10)}). It may have
            been filled.
          </p>
        )}
      </header>
      <ApplyPanel job={job} />
      <ApplicationForm jobId={job.id} />
      <ApplicationForm jobId={job.id} />
      <ApplicationForm jobId={job.id} />
      <div
        className="text-sm leading-relaxed [&_a]:underline [&_h1]:text-lg [&_h1]:font-semibold [&_h2]:font-semibold [&_h3]:font-semibold [&_li]:my-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-2 [&_ul]:list-disc [&_ul]:pl-5"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </article>
  )
}
