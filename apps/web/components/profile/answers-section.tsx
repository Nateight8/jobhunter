"use client";

import { useState } from "react";
import { useMutation, useSuspenseQuery } from "@apollo/client/react";
import { ANSWERS_QUERY, SAVE_ANSWERS_MUTATION } from "../../lib/answer-queries";
import type { AnswerType } from "../../lib/gql/graphql";
import { Section, inputClass } from "./fields";

type Row = { key: string | null; question: string; answerType: AnswerType; answer: string };

const small = "rounded-md border px-2 py-1 text-xs hover:bg-muted";

export function AnswersSection() {
  const { data } = useSuspenseQuery(ANSWERS_QUERY);
  const [save, { loading }] = useMutation(SAVE_ANSWERS_MUTATION, { refetchQueries: [ANSWERS_QUERY] });

  const [rows, setRows] = useState<Row[]>(() =>
    data.answers.map((a) => ({
      key: a.key,
      question: a.question,
      answerType: a.answerType,
      answer: a.answer ?? "",
    })),
  );
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const edit = (i: number, patch: Partial<Row>) => {
    setRows((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)));
    setSaved(false);
  };

  async function onSave() {
    setError(null);
    setSaved(false);
    try {
      const res = await save({
        variables: {
          items: rows
            .filter((r) => r.key || r.question.trim()) // drop empty custom rows
            .map((r) => ({
              key: r.key,
              question: r.question.trim(),
              answerType: r.answerType,
              answer: r.answer.trim() || null,
            })),
        },
      });
      const next = res.data?.saveAnswers;
      if (next) {
        setRows(next.map((a) => ({ key: a.key, question: a.question, answerType: a.answerType, answer: a.answer ?? "" })));
      }
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    }
  }

  return (
    <Section
      title="Application answers"
      description="Forms ask the same questions again and again. Answers saved here are used to fill them. A question left empty is never guessed: the form field stays blank for you."
    >
      <ul className="space-y-4">
        {rows.map((r, i) => (
          <li key={i} className="space-y-2">
            {r.key ? (
              <p className="text-sm font-medium">{r.question}</p>
            ) : (
              <input
                className={inputClass}
                value={r.question}
                maxLength={300}
                placeholder="Your own question, worded as the form asks it"
                onChange={(e) => edit(i, { question: e.target.value })}
              />
            )}
            <div className="flex items-center gap-2">
              {r.answerType === "YES_NO" ? (
                <select
                  className="rounded-md border bg-background px-2 py-2 text-sm"
                  value={r.answer}
                  onChange={(e) => edit(i, { answer: e.target.value })}
                >
                  <option value="">Not answered</option>
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                </select>
              ) : (
                <input
                  className={inputClass}
                  value={r.answer}
                  maxLength={2000}
                  placeholder="Not answered"
                  onChange={(e) => edit(i, { answer: e.target.value })}
                />
              )}
              {!r.key && (
                <>
                  <select
                    className="rounded-md border bg-background px-2 py-2 text-sm"
                    value={r.answerType}
                    onChange={(e) => edit(i, { answerType: e.target.value as AnswerType, answer: "" })}
                  >
                    <option value="TEXT">Text</option>
                    <option value="YES_NO">Yes / No</option>
                  </select>
                  <button type="button" className={small} onClick={() => setRows(rows.filter((_, j) => j !== i))}>
                    Remove
                  </button>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>

      <button
        type="button"
        className={small}
        onClick={() => setRows([...rows, { key: null, question: "", answerType: "TEXT", answer: "" }])}
      >
        Add a question
      </button>

      <p className="text-xs text-muted-foreground">
        &quot;Are you authorized to work in X?&quot; isn&apos;t here on purpose: the right answer depends on the
        job&apos;s country, so it is answered per job.
      </p>

      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={loading}
          onClick={() => void onSave()}
          className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
        >
          {loading ? "Saving…" : "Save answers"}
        </button>
        {error && <span className="text-sm text-destructive">{error}</span>}
        {!error && saved && <span className="text-sm text-muted-foreground">Saved.</span>}
      </div>
    </Section>
  );
}
