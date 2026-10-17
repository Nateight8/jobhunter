"use client";

import { useEffect, useMemo, useState } from "react";
import { useSuspenseQuery } from "@apollo/client/react";
import { JOB_QUERY } from "../lib/queries";
import { sanitizeHtml } from "../lib/sanitize";

export function JobDetail({ id }: { id: string | null }) {
  if (!id) return <p className="text-sm text-muted-foreground">Select a job to see details.</p>;
  return <LoadedJob id={id} />;
}

function LoadedJob({ id }: { id: string }) {
  const { data } = useSuspenseQuery(JOB_QUERY, { variables: { id } });
  const job = data.job;

  // Sanitizing needs the DOM, so render the description only after mount.
  // This keeps the server and first client render identical (no hydration mismatch).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const html = useMemo(
    () => (mounted ? sanitizeHtml(job?.description ?? "") : ""),
    [mounted, job?.description],
  );

  if (!job) return <p className="text-sm text-muted-foreground">Job not found.</p>;

  return (
    <article className="space-y-3">
      <header className="space-y-1">
        <h2 className="text-xl font-semibold">{job.title}</h2>
        <p className="text-sm text-muted-foreground">
          {job.companyName}
          {job.location ? ` · ${job.location}` : ""} · {job.remoteType.toLowerCase()}
        </p>
        <p className="text-xs text-muted-foreground">
          First seen {new Date(job.firstSeenAt).toISOString().slice(0, 10)} · via{" "}
          <a href={job.url} target="_blank" rel="noopener noreferrer" className="underline">
            {job.source}
          </a>
        </p>
        <a
          href={job.applyUrl ?? job.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground"
        >
          Apply
        </a>
      </header>
      <div
        className="text-sm leading-relaxed [&_a]:underline [&_h1]:text-lg [&_h1]:font-semibold [&_h2]:font-semibold [&_h3]:font-semibold [&_li]:my-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-2 [&_ul]:list-disc [&_ul]:pl-5"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </article>
  );
}
