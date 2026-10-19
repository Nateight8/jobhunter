"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useMutation, useSuspenseQuery } from "@apollo/client/react";
import {
  DELETE_MEMORY_MUTATION,
  MEMORY_QUERY,
  SAVE_MEMORY_MUTATION,
} from "../lib/memory-queries";
import type { AnswerType } from "../lib/gql/graphql";

type Draft = { question: string; answerType: AnswerType; answer: string };

const input = "w-full rounded-md border bg-background px-3 py-2 text-sm";
const small = "rounded-md border px-2 py-1 text-xs hover:bg-muted";
const msg = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong");

function EntryForm(props: {
  initial: Draft;
  submitLabel: string;
  onSubmit: (d: Draft) => Promise<void>;
  onCancel: () => void;
}) {
  const [d, setD] = useState(props.initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      await props.onSubmit(d);
    } catch (e) {
      setError(msg(e));
      setSaving(false);
    }
  }

  return (
    <div className="space-y-2 rounded-md border bg-muted/30 p-3">
      <input
        className={input}
        value={d.question}
        maxLength={300}
        placeholder="The question, worded as a form asks it"
        onChange={(e) => setD({ ...d, question: e.target.value })}
      />
      <div className="flex items-center gap-2">
        <select
          className="rounded-md border bg-background px-2 py-2 text-sm"
          value={d.answerType}
          onChange={(e) => setD({ ...d, answerType: e.target.value as AnswerType, answer: "" })}
        >
          <option value="TEXT">Text</option>
          <option value="YES_NO">Yes / No</option>
        </select>
        {d.answerType === "YES_NO" ? (
          <select
            className="rounded-md border bg-background px-2 py-2 text-sm"
            value={d.answer}
            onChange={(e) => setD({ ...d, answer: e.target.value })}
          >
            <option value="">Choose…</option>
            <option value="Yes">Yes</option>
            <option value="No">No</option>
          </select>
        ) : (
          <input
            className={input}
            value={d.answer}
            maxLength={2000}
            placeholder="Your answer"
            onChange={(e) => setD({ ...d, answer: e.target.value })}
          />
        )}
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={() => void submit()}
          className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
        >
          {saving ? "Saving…" : props.submitLabel}
        </button>
        <button type="button" className={small} onClick={props.onCancel}>
          Cancel
        </button>
        {error && <span className="text-sm text-destructive">{error}</span>}
      </div>
    </div>
  );
}

function MemoryList() {
  const { data } = useSuspenseQuery(MEMORY_QUERY);
  const refetch = { refetchQueries: [MEMORY_QUERY] };
  const [save] = useMutation(SAVE_MEMORY_MUTATION, refetch);
  const [remove] = useMutation(DELETE_MEMORY_MUTATION, refetch);
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const entries = data.memory;

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-destructive">{error}</p>}

      {editing === "new" ? (
        <EntryForm
          initial={{ question: "", answerType: "TEXT", answer: "" }}
          submitLabel="Add to memory"
          onCancel={() => setEditing(null)}
          onSubmit={async (d) => {
            await save({ variables: { question: d.question, answerType: d.answerType, answer: d.answer } });
            setEditing(null);
          }}
        />
      ) : (
        <button type="button" className={small} onClick={() => setEditing("new")}>
          Add an entry by hand
        </button>
      )}

      {entries.length === 0 && (
        <p className="rounded-md border p-4 text-sm text-muted-foreground">
          Nothing here yet. You don&apos;t need to fill anything in. When you answer a question while
          applying, you&apos;ll be asked whether to remember it, and anything you approve shows up here.
        </p>
      )}

      <ul className="space-y-3">
        {entries.map((e) => (
          <li key={e.id} className="space-y-2 rounded-md border p-3 text-sm">
            {editing === e.id ? (
              <EntryForm
                initial={{ question: e.question, answerType: e.answerType, answer: e.answer }}
                submitLabel="Save changes"
                onCancel={() => setEditing(null)}
                onSubmit={async (d) => {
                  await save({
                    variables: { id: e.id, question: d.question, answerType: d.answerType, answer: d.answer },
                  });
                  setEditing(null);
                }}
              />
            ) : (
              <>
                <p className="font-medium">{e.question}</p>
                <p className="whitespace-pre-wrap">{e.answer}</p>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    Updated {new Date(e.updatedAt).toISOString().slice(0, 10)}
                  </span>
                  <button type="button" className={small} onClick={() => setEditing(e.id)}>
                    Edit
                  </button>
                  <button
                    type="button"
                    className={small}
                    onClick={() => {
                      if (!window.confirm("Forget this?")) return;
                      setError(null);
                      remove({ variables: { id: e.id } }).catch((err: unknown) => setError(msg(err)));
                    }}
                  >
                    Delete
                  </button>
                </div>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function MemoryPage() {
  return (
    <main className="mx-auto max-w-3xl space-y-4 p-4">
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Memory</h1>
        <Link href="/" className="text-sm underline">
          Back to jobs
        </Link>
      </header>
      <p className="text-sm text-muted-foreground">
        Answers you&apos;ve approved to reuse on later applications. Nothing is added without your say-so.
        Check the dates, since things like salary expectations go out of date. If a question isn&apos;t
        here, the form field stays blank for you.
      </p>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
        <MemoryList />
      </Suspense>
    </main>
  );
}
