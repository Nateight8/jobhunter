"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation } from "@apollo/client/react";
import {
  BOARD_COUNTS_QUERY,
  BOARDS_QUERY,
  CREATE_BOARD_MUTATION,
  UPDATE_BOARD_MUTATION,
} from "../lib/board-queries";
import { csv, filtersToBoardInput, isRemote, REMOTE_OPTIONS, writeOverrides, type FeedFilters } from "../lib/filters";
import { useFeedFilters } from "../lib/use-feed-filters";

const input = "w-full rounded-md border bg-background px-3 py-2 text-sm";
const button = "rounded-md border px-3 py-2 text-sm hover:bg-muted disabled:opacity-50";

export function Filters() {
  const router = useRouter();
  const { sp, board, base, filters: f, dirty } = useFeedFilters();
  const refetch = { refetchQueries: [BOARDS_QUERY, BOARD_COUNTS_QUERY] };
  const [updateBoard, { loading: updating }] = useMutation(UPDATE_BOARD_MUTATION, refetch);
  const [createBoard, { loading: creating }] = useMutation(CREATE_BOARD_MUTATION, refetch);
  const [naming, setNaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const boardParam = board ? { board: board.id } : {};
  const go = (p: URLSearchParams) => {
    for (const [k, v] of Object.entries(boardParam)) p.set(k, v);
    router.replace(`?${p.toString()}`, { scroll: false });
  };

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const next: FeedFilters = {
      ...base, // sources and startup size pass through
      q: String(fd.get("q") ?? "").trim(),
      stack: csv(String(fd.get("stack") ?? "")),
      remote: fd.getAll("remote").map(String).filter(isRemote),
      startup: !!fd.get("startup"),
      titleIncludes: csv(String(fd.get("tin") ?? "")),
      titleExcludes: csv(String(fd.get("tex") ?? "")),
    };
    setNaming(false);
    go(writeOverrides(base, next));
  }

  async function saveToBoard() {
    if (!board) return;
    setError(null);
    try {
      await updateBoard({ variables: { id: board.id, filter: filtersToBoardInput(f) } });
      router.replace(`?board=${board.id}`, { scroll: false });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save");
    }
  }

  async function saveAsNew(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const name = String(new FormData(e.currentTarget).get("name") ?? "").trim();
    if (!name) return;
    setError(null);
    try {
      const res = await createBoard({ variables: { name, filter: filtersToBoardInput(f) } });
      setNaming(false);
      const id = res.data?.createBoard.id;
      if (id) router.push(`/?board=${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save");
    }
  }

  return (
    <div className="space-y-3">
      {/* key resets the uncontrolled inputs when the URL changes (back button, links) */}
      <form key={sp.toString()} onSubmit={onSubmit} className="space-y-3">
        <input name="q" defaultValue={f.q} placeholder="Search title or company" className={input} />
        <input name="stack" defaultValue={f.stack.join(", ")} placeholder="Stack: react, node, python" className={input} />
        <input name="tin" defaultValue={f.titleIncludes.join(", ")} placeholder="Title contains: intern, devops" className={input} />
        <input name="tex" defaultValue={f.titleExcludes.join(", ")} placeholder="Title excludes: senior, manager" className={input} />
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {REMOTE_OPTIONS.map((o) => (
            <label key={o.value} className="flex items-center gap-1.5">
              <input type="checkbox" name="remote" value={o.value} defaultChecked={f.remote.includes(o.value)} />
              {o.label}
            </label>
          ))}
          <label className="flex items-center gap-1.5">
            <input type="checkbox" name="startup" defaultChecked={f.startup} />
            Startups only
          </label>
        </div>
        <button type="submit" className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground">
          Apply filters
        </button>
      </form>

      {dirty && (
        <div className="space-y-2 rounded-md border p-3 text-sm">
          <p className="text-muted-foreground">
            {board ? `Changed from "${board.name}".` : "Filters applied."}
          </p>
          <div className="flex flex-wrap gap-2">
            {board && (
              <button type="button" className={button} disabled={updating} onClick={() => void saveToBoard()}>
                Save to this board
              </button>
            )}
            <button type="button" className={button} onClick={() => setNaming(true)}>
              Save as new board
            </button>
            <Link href={board ? `/?board=${board.id}` : "/"} className={button}>
              Clear changes
            </Link>
          </div>
          {naming && (
            <form onSubmit={saveAsNew} className="flex gap-2">
              <input name="name" autoFocus placeholder="Board name" maxLength={60} className={input} />
              <button type="submit" disabled={creating} className={button}>
                Save
              </button>
            </form>
          )}
          {error && <p className="text-destructive">{error}</p>}
        </div>
      )}
    </div>
  );
}
