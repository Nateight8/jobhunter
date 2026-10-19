"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "@apollo/client/react";
import {
  CLEAR_JOB_ANSWER_MUTATION,
  JOB_FORM_QUERY,
  SAVE_JOB_ANSWER_MUTATION,
} from "../lib/form-queries";
import type { JobFormFieldsFragment } from "../lib/gql/graphql";

type Question = JobFormFieldsFragment["questions"][number];

const input = "w-full rounded-md border bg-background px-3 py-2 text-sm";
const small = "rounded-md border px-2 py-1 text-xs hover:bg-muted disabled:opacity-50";

const SOURCE_LABEL = {
  PROFILE: "From your profile",
  JOB_ANSWER: "Your answer for this job",
  MEMORY: "From memory",
  NONE: "Needs your answer",
} as const;

function QuestionCard({ jobId, q }: { jobId: string; q: Question }) {
  const [save, { loading: saving }] = useMutation(SAVE_JOB_ANSWER_MUTATION);
  const [clear, { loading: clearing }] = useMutation(CLEAR_JOB_ANSWER_MUTATION);
  const [value, setValue] = useState(q.resolution.value ?? "");
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const source = q.resolution.source;
  const editable = q.kind === "TEXT" || q.kind === "TEXTAREA" || q.kind === "SELECT";
  const changed = value.trim() !== (q.resolution.value ?? "");
  const busy = saving || clearing;

  async function onSave() {
    setError(null);
    try {
      await save({ variables: { jobId, key: q.key, answer: value, remember } });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    }
  }

  return (
    <li className="space-y-2 rounded-md border p-3 text-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="font-medium">
          {q.label}
          {q.required && <span className="text-destructive"> *</span>}
        </p>
        <span
          className={`shrink-0 rounded border px-1.5 py-0.5 text-xs ${
            source === "NONE" ? "text-destructive" : "text-muted-foreground"
          }`}
        >
          {SOURCE_LABEL[source]}
        </span>
      </div>
      {q.description && <p className="text-xs text-muted-foreground">{q.description}</p>}

      {!editable && (
        <p className="text-xs text-muted-foreground">Answer this one on the employer&apos;s form.</p>
      )}

      {source === "PROFILE" && <p className="break-all">{q.resolution.value}</p>}

      {editable && source !== "PROFILE" && (
        <>
          {q.kind === "SELECT" ? (
            <select className={input} value={value} onChange={(e) => setValue(e.target.value)}>
              <option value="">Choose…</option>
              {q.options.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          ) : q.kind === "TEXTAREA" ? (
            <textarea className={input} rows={4} value={value} onChange={(e) => setValue(e.target.value)} />
          ) : (
            <input className={input} value={value} onChange={(e) => setValue(e.target.value)} />
          )}
          <div className="flex flex-wrap items-center gap-3">
            {(source !== "MEMORY" || changed) && (
              <label className="flex items-center gap-1.5 text-xs">
                <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                Remember for future applications
              </label>
            )}
            <button
              type="button"
              className={small}
              disabled={busy || !value.trim() || (!changed && !remember && source === "JOB_ANSWER")}
              onClick={() => void onSave()}
            >
              {saving ? "Saving…" : source === "JOB_ANSWER" ? "Update answer" : "Save answer"}
            </button>
            {source === "JOB_ANSWER" && (
              <button
                type="button"
                className={small}
                disabled={busy}
                onClick={() => void clear({ variables: { jobId, key: q.key } })}
              >
                Clear
              </button>
            )}
          </div>
        </>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </li>
  );
}

export function ApplicationForm({ jobId }: { jobId: string }) {
  const { data, loading, error, refetch } = useQuery(JOB_FORM_QUERY, { variables: { jobId } });
  const [refreshing, setRefreshing] = useState(false);

  if (loading && !data) {
    return <p className="text-sm text-muted-foreground">Checking the application form…</p>;
  }
  if (error) return <p className="text-sm text-destructive">Couldn&apos;t load the application form: {error.message}</p>;

  const form = data?.jobForm;
  if (!form) return null;

  if (!form.supported) {
    return <p className="text-xs text-muted-foreground">{form.reason}</p>;
  }

  const needing = form.questions.filter((q) => q.required && q.resolution.source === "NONE");
  const required = (label: string) => form.files.find((f) => f.label.toLowerCase().includes(label));
  const cover = required("cover");

  return (
    <section className="space-y-3 rounded-md border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">Application form</h2>
        <button
          type="button"
          className={small}
          disabled={refreshing}
          onClick={async () => {
            setRefreshing(true);
            try {
              await refetch({ jobId, refresh: true });
            } finally {
              setRefreshing(false);
            }
          }}
        >
          {refreshing ? "Refreshing…" : "Refresh questions"}
        </button>
      </div>

      {form.reason && <p className="text-xs text-muted-foreground">{form.reason}</p>}

      {form.questions.length > 0 || form.files.length > 0 ? (
        <>
          <p className="text-sm text-muted-foreground">
            Name, email and phone come from your profile.
            {form.files.length > 0 &&
              ` Files: ${form.files.map((f) => `${f.label}${f.required ? " (required)" : ""}`).join(", ")}.`}
            {cover && " Write the cover letter yourself for now."}
          </p>
          {form.questions.length > 0 && (
            <p className="text-sm">
              {form.questions.length} custom {form.questions.length === 1 ? "question" : "questions"}
              {needing.length > 0 ? `, ${needing.length} required without an answer yet` : ", every required one has an answer"}.
            </p>
          )}
          <ul className="space-y-2">
            {form.questions.map((q) => (
              <QuestionCard
                key={`${q.key}-${q.resolution.source}-${q.resolution.value ?? ""}`}
                jobId={jobId}
                q={q}
              />
            ))}
          </ul>
          {form.hasSurvey && (
            <p className="text-xs text-muted-foreground">
              This application also has optional demographic questions. They are never filled in for you.
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Answers saved here are used when filling the form. Tick &quot;Remember&quot; to reuse one later, and manage
            what&apos;s remembered in <Link href="/memory" className="underline">Memory</Link>.
          </p>
        </>
      ) : (
        !form.reason && <p className="text-sm text-muted-foreground">This application has no custom questions.</p>
      )}
    </section>
  );
}
