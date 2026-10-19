"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@apollo/client/react";
import { APPLY_PROFILE_QUERY } from "../lib/application-queries";
import type { ApplicationStatus, JobQuery } from "../lib/gql/graphql";
import { useApplicationActions } from "../lib/use-application-actions";
import { STATUS_LABEL } from "./job-list";

type Job = NonNullable<JobQuery["job"]>;

const btn = "rounded-md border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50";
const FOLLOW_UP: ApplicationStatus[] = ["APPLIED", "INTERVIEWING", "OFFER", "REJECTED"];

// Boards we know have a standard application form get a named button.
const ATS: Record<string, string> = { greenhouse: "Greenhouse", lever: "Lever", ashby: "Ashby" };

function CopyRow({ label, value }: { label: string; value: string }) {
  const [done, setDone] = useState(false);
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="min-w-0">
        <span className="text-muted-foreground">{label}: </span>
        <span className="break-all">{value}</span>
      </span>
      <button
        type="button"
        className="shrink-0 rounded-md border px-2 py-1 text-xs hover:bg-muted"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setDone(true);
            setTimeout(() => setDone(false), 1500);
          } catch {
            /* clipboard blocked: the value is on screen to copy by hand */
          }
        }}
      >
        {done ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

export function ApplyPanel({ job }: { job: Job }) {
  const { data } = useQuery(APPLY_PROFILE_QUERY);
  const { setStatus, remove, setNotes } = useApplicationActions();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotesText] = useState(job.application?.notes ?? "");
  const [notesSaved, setNotesSaved] = useState(false);

  const status = job.applicationStatus;
  const progressed = status !== null && status !== "SAVED" && status !== "HIDDEN";
  const profile = data?.profile;
  const cv = profile?.documents.find((d) => d.kind === "CV" && d.isDefault) ?? null;
  const applyHref = job.applyUrl ?? job.url;
  const applyLabel = ATS[job.source] ? `Apply on ${ATS[job.source]}` : "Open the application";

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  const fields: [string, string][] = [];
  if (profile) {
    const all: [string, string | null][] = [
      ["Name", profile.fullName],
      ["Email", profile.email],
      ["Phone", profile.phone],
      ["LinkedIn", profile.linkedinUrl],
      ["GitHub", profile.githubUrl],
      ["Portfolio", profile.portfolioUrl],
    ];
    for (const [label, value] of all) if (value) fields.push([label, value]);
  }

  return (
    <section className="space-y-4 rounded-md border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <a href={applyHref} target="_blank" rel="noopener noreferrer" className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">
          {applyLabel}
        </a>
        {status && <span className="rounded border px-2 py-1 text-xs text-muted-foreground">{STATUS_LABEL[status]}</span>}
        {status === null && (
          <>
            <button type="button" className={btn} disabled={busy} onClick={() => void run(() => setStatus(job.id, "SAVED"))}>
              Save
            </button>
            <button type="button" className={btn} disabled={busy} onClick={() => void run(() => setStatus(job.id, "HIDDEN"))}>
              Not interested
            </button>
          </>
        )}
        {status === "SAVED" && (
          <button type="button" className={btn} disabled={busy} onClick={() => void run(() => remove(job.id))}>
            Unsave
          </button>
        )}
        {status === "HIDDEN" && (
          <button type="button" className={btn} disabled={busy} onClick={() => void run(() => remove(job.id))}>
            Restore
          </button>
        )}
      </div>

      {!progressed && (
        <div className="space-y-3 border-t pt-3">
          <p className="text-sm font-medium">Have these ready for the application</p>
          {!profile?.fullName ? (
            <p className="text-sm text-muted-foreground">
              Your CV and contact details show up here once your profile is set up.{" "}
              <Link href="/profile" className="underline">
                Set up profile
              </Link>
            </p>
          ) : (
            <>
              <div className="space-y-2">
                {cv ? (
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span>
                      <span className="text-muted-foreground">CV: </span>
                      {cv.filename}
                    </span>
                    <a href={cv.downloadUrl} target="_blank" rel="noopener noreferrer" className="shrink-0 rounded-md border px-2 py-1 text-xs hover:bg-muted">
                      Download
                    </a>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No CV uploaded yet.</p>
                )}
                {fields.map(([label, value]) => (
                  <CopyRow key={label} label={label} value={value} />
                ))}
              </div>
              <button
                type="button"
                className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
                disabled={busy}
                onClick={() => void run(() => setStatus(job.id, "APPLIED"))}
              >
                I&apos;ve applied
              </button>
              <p className="text-xs text-muted-foreground">
                Nothing is sent from here. You submit on the employer&apos;s page, then record it.
              </p>
            </>
          )}
        </div>
      )}

      {progressed && (
        <div className="space-y-3 border-t pt-3">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <label className="flex items-center gap-2">
              Status
              <select
                value={status ?? "APPLIED"}
                disabled={busy}
                onChange={(e) => void run(() => setStatus(job.id, e.target.value as ApplicationStatus))}
                className="rounded-md border bg-background px-2 py-1"
              >
                {FOLLOW_UP.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
            </label>
            {job.application?.appliedAt && (
              <span className="text-muted-foreground">
                Applied {new Date(job.application.appliedAt).toISOString().slice(0, 10)}
              </span>
            )}
            <button type="button" className={btn} disabled={busy} onClick={() => void run(() => remove(job.id))}>
              Remove from tracker
            </button>
          </div>
          <label className="block space-y-1 text-sm">
            <span className="font-medium">Notes</span>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => {
                setNotesText(e.target.value);
                setNotesSaved(false);
              }}
              placeholder="Who you contacted, interview dates, follow-ups…"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className={btn}
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await setNotes(job.id, notes);
                  setNotesSaved(true);
                })
              }
            >
              Save notes
            </button>
            {notesSaved && <span className="text-xs text-muted-foreground">Saved</span>}
          </div>
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
    </section>
  );
}
