"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useSuspenseQuery } from "@apollo/client/react";
import {
  BOARD_COUNTS_QUERY,
  BOARDS_QUERY,
  DELETE_BOARD_MUTATION,
  REORDER_BOARDS_MUTATION,
  RESET_RECOMMENDED_MUTATION,
  UPDATE_BOARD_MUTATION,
} from "../lib/board-queries";
import { boardToFilters, describeFilter } from "../lib/filters";

const button = "rounded-md border px-2 py-1 text-xs hover:bg-muted disabled:opacity-40";
const msg = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong");

export function BoardsPage() {
  const { data } = useSuspenseQuery(BOARDS_QUERY);
  const { data: counts } = useQuery(BOARD_COUNTS_QUERY);
  const refetch = { refetchQueries: [BOARDS_QUERY, BOARD_COUNTS_QUERY] };
  const [update] = useMutation(UPDATE_BOARD_MUTATION, refetch);
  const [remove] = useMutation(DELETE_BOARD_MUTATION, refetch);
  const [reorder] = useMutation(REORDER_BOARDS_MUTATION, refetch);
  const [resetRecommended] = useMutation(RESET_RECOMMENDED_MUTATION, refetch);
  const [error, setError] = useState<string | null>(null);

  const boards = data.boards;
  const hasRecommended = boards.some((b) => b.kind === "recommended");

  async function run(fn: () => Promise<unknown>) {
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(msg(e));
    }
  }

  const move = (i: number, d: number) => {
    const ids = boards.map((b) => b.id);
    const [id] = ids.splice(i, 1);
    ids.splice(i + d, 0, id!);
    return run(() => reorder({ variables: { ids } }));
  };

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-4">
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Boards</h1>
        <Link href="/" className="text-sm underline">
          Back to jobs
        </Link>
      </header>
      <p className="text-sm text-muted-foreground">
        A board is a saved search. The name is only a label; the filter decides which jobs appear.
        Change a board&apos;s filter from the jobs page and press &quot;Save to this board&quot;.
        &quot;All&quot; is always there and is not a board.
      </p>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <ul className="space-y-3">
        {boards.map((b, i) => {
          const c = counts?.boards.find((x) => x.id === b.id)?.count;
          return (
            <li key={b.id} className="space-y-2 rounded-md border p-3">
              <div className="flex items-center gap-2">
                <input
                  key={`${b.id}-${b.name}`}
                  defaultValue={b.name}
                  maxLength={60}
                  aria-label="Board name"
                  className="min-w-0 flex-1 rounded-md border bg-background px-2 py-1 text-sm font-medium"
                  onBlur={(e) => {
                    const name = e.target.value.trim();
                    if (name && name !== b.name) void run(() => update({ variables: { id: b.id, name } }));
                    else e.target.value = b.name;
                  }}
                  onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                />
                {c && (
                  <span className="text-xs text-muted-foreground">
                    {c.value}
                    {c.capped ? "+" : ""} jobs
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground">{describeFilter(boardToFilters(b.filter))}</p>
              <div className="flex flex-wrap gap-2">
                <Link href={`/?board=${b.id}`} className={button}>
                  Open
                </Link>
                <button type="button" className={button} disabled={i === 0} onClick={() => void move(i, -1)}>
                  Move up
                </button>
                <button
                  type="button"
                  className={button}
                  disabled={i === boards.length - 1}
                  onClick={() => void move(i, 1)}
                >
                  Move down
                </button>
                {b.kind === "recommended" && (
                  <button
                    type="button"
                    className={button}
                    onClick={() => {
                      if (window.confirm("Replace this board's filters with ones generated from your CV?")) {
                        void run(() => resetRecommended());
                      }
                    }}
                  >
                    Reset to CV defaults
                  </button>
                )}
                <button
                  type="button"
                  className={button}
                  onClick={() => {
                    if (window.confirm(`Delete "${b.name}"?`)) {
                      void run(() => remove({ variables: { id: b.id } }));
                    }
                  }}
                >
                  Delete
                </button>
              </div>
            </li>
          );
        })}
        {boards.length === 0 && <li className="text-sm text-muted-foreground">No boards yet.</li>}
      </ul>

      {!hasRecommended && (
        <section className="space-y-2 rounded-md border p-3">
          <p className="text-sm">
            Recommended is built from the technologies on your CV. It isn&apos;t on your tab bar right now.
          </p>
          <button type="button" className={button} onClick={() => void run(() => resetRecommended())}>
            Create Recommended from my CV
          </button>
          <p className="text-xs text-muted-foreground">
            Needs a saved profile with technologies in your experience, or skills.{" "}
            <Link href="/profile" className="underline">
              Open profile
            </Link>
          </p>
        </section>
      )}
    </main>
  );
}
