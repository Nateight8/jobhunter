"use client";

import { useEffect, useRef, useState } from "react";
import { useApolloClient, useMutation, useQuery } from "@apollo/client/react";
import { APPLY_RUN_QUERY, START_APPLY_MUTATION } from "../lib/apply-run-queries";
import { JOB_QUERY } from "../lib/queries";

const ACTIVE = new Set(["QUEUED", "OPENING", "FILLING", "NEEDS_YOU"]);
const btn = "rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50";

export function AutoFill({ jobId, applied }: { jobId: string; applied: boolean }) {
  const client = useApolloClient();
  const { data, refetch, startPolling, stopPolling } = useQuery(APPLY_RUN_QUERY, { variables: { jobId } });
  const [start, { loading: starting }] = useMutation(START_APPLY_MUTATION);
  const [error, setError] = useState<string | null>(null);

  const run = data?.applyRun ?? null;
  const active = !!run && ACTIVE.has(run.status);

  // Poll while a run is in progress; refresh the job page once it has been submitted.
  useEffect(() => {
    if (active) startPolling(2000);
    else stopPolling();
    return () => stopPolling();
  }, [active, startPolling, stopPolling]);

  const previous = useRef<string | null>(null);
  useEffect(() => {
    if (run?.status === "SUBMITTED" && previous.current !== "SUBMITTED") {
      void client.refetchQueries({ include: [JOB_QUERY] });
    }
    previous.current = run?.status ?? null;
  }, [run?.status, client]);

  async function onStart() {
    setError(null);
    try {
      await start({ variables: { jobId } });
      await refetch();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    }
  }

  const waited = run ? Date.now() - new Date(run.createdAt).getTime() : 0;
  const filled = run?.outcomes.filter((o) => o.state === "FILLED") ?? [];
  const check = run?.outcomes.filter((o) => o.state === "CHECK") ?? [];
  const left = run?.outcomes.filter((o) => o.state === "LEFT" || o.state === "FAILED") ?? [];

  return (
    <section className="space-y-3 rounded-md border p-4 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">Auto-fill this application</h2>
        {!active && !applied && (
          <button type="button" className={btn} disabled={starting} onClick={() => void onStart()}>
            {starting ? "Starting…" : run ? "Run again" : "Auto-fill the form"}
          </button>
        )}
      </div>

      {!run && !applied && (
        <p className="text-muted-foreground">
          Opens the application in a browser window on this computer and fills in what it can from your
          profile and saved answers. It never submits: you review the form and press Submit yourself.
        </p>
      )}

      {run?.status === "QUEUED" && (
        <p>
          Waiting for the runner…
          {waited > 8000 && (
            <span className="text-destructive"> Nothing has picked this up. Start it with `make runner`.</span>
          )}
        </p>
      )}
      {(run?.status === "OPENING" || run?.status === "FILLING") && (
        <p>Opening the form and filling it. A browser window should appear.</p>
      )}

      {run?.status === "NEEDS_YOU" && (
        <div className="space-y-2">
          <p className="font-medium">Your turn. Check the browser window.</p>
          <p>{run.message}</p>
          <p className="text-xs text-muted-foreground">
            I&apos;ll notice when you submit, save a screenshot of the confirmation and mark this job as applied.
            CAPTCHAs and emailed security codes are always yours to complete in that window.
          </p>
        </div>
      )}

      {run?.status === "SUBMITTED" && (
        <div className="space-y-2">
          <p className="font-medium">Submitted.</p>
          <p>{run.message}</p>
          {run.screenshotUrl && (
            <a href={run.screenshotUrl} target="_blank" rel="noopener noreferrer" className="block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={run.screenshotUrl} alt="Confirmation page" className="max-h-72 rounded-md border" />
              <span className="text-xs underline">Open the confirmation screenshot</span>
            </a>
          )}
        </div>
      )}

      {run && ["CLOSED", "FAILED", "ABANDONED"].includes(run.status) && (
        <p className={run.status === "FAILED" ? "text-destructive" : "text-muted-foreground"}>{run.message}</p>
      )}

      {run && run.outcomes.length > 0 && (
        <details>
          <summary className="cursor-pointer text-muted-foreground">
            What was filled ({filled.length}), to check ({check.length}), left for you ({left.length})
          </summary>
          <ul className="mt-2 space-y-1">
            {run.outcomes.map((o) => (
              <li key={o.key} className="text-xs">
                <span className="font-medium">{o.label}</span>
                {o.required && <span className="text-destructive"> *</span>}: {o.state.toLowerCase()}
                {o.note ? ` (${o.note})` : ""}
              </li>
            ))}
          </ul>
        </details>
      )}

      {run && run.log.length > 0 && (
        <details>
          <summary className="cursor-pointer text-xs text-muted-foreground">Run log</summary>
          <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
            {run.log.map((l, i) => (
              <li key={i} className="break-all">
                {new Date(l.at).toISOString().slice(11, 19)} {l.text}
              </li>
            ))}
          </ul>
        </details>
      )}

      {error && <p className="text-destructive">{error}</p>}
    </section>
  );
}
