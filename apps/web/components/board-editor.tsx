"use client";

import { useState, type FormEvent } from "react";
import { csv, describeFilter, REMOTE_OPTIONS, type FeedFilters } from "../lib/filters";
import type { RemoteType } from "../lib/gql/graphql";

// Names written by the pipeline into jobs.source.
export const SOURCE_OPTIONS = ["greenhouse", "lever", "ashby", "remoteok", "remotive", "hackernews"];

const input = "w-full rounded-md border bg-background px-3 py-2 text-sm";
const button = "rounded-md border px-3 py-2 text-sm hover:bg-muted disabled:opacity-50";
const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

export function BoardEditor(props: {
  initialName: string;
  initialFilters: FeedFilters;
  submitLabel: string;
  saving: boolean;
  error: string | null;
  onSubmit: (name: string, filters: FeedFilters) => void;
  onCancel: () => void;
}) {
  const init = props.initialFilters;
  const [name, setName] = useState(props.initialName);
  const [q, setQ] = useState(init.q);
  const [stack, setStack] = useState(init.stack.join(", "));
  const [tin, setTin] = useState(init.titleIncludes.join(", "));
  const [tex, setTex] = useState(init.titleExcludes.join(", "));
  const [remote, setRemote] = useState<RemoteType[]>(init.remote);
  const [sources, setSources] = useState<string[]>(init.sources);
  const [startup, setStartup] = useState(init.startup);
  const [startupMax, setStartupMax] = useState(init.startupMax ? String(init.startupMax) : "");
  const [localError, setLocalError] = useState<string | null>(null);

  const max = Number(startupMax);
  const current: FeedFilters = {
    q: q.trim(),
    stack: csv(stack),
    remote,
    startup,
    titleIncludes: csv(tin),
    titleExcludes: csv(tex),
    sources,
    startupMax: startup && Number.isInteger(max) && max > 0 ? max : null,
  };

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setLocalError("Give the board a name");
      return;
    }
    setLocalError(null);
    props.onSubmit(name.trim(), current);
  }

  const error = localError ?? props.error;

  return (
    <form onSubmit={submit} className="space-y-3 rounded-md border bg-muted/30 p-3">
      <label className="block space-y-1">
        <span className="text-sm font-medium">Name</span>
        <input className={input} value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1">
          <span className="text-sm font-medium">Search</span>
          <input className={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Title or company" />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium">Stack</span>
          <input className={input} value={stack} onChange={(e) => setStack(e.target.value)} placeholder="react, node, python" />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium">Title contains</span>
          <input className={input} value={tin} onChange={(e) => setTin(e.target.value)} placeholder="intern, devops" />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium">Title excludes</span>
          <input className={input} value={tex} onChange={(e) => setTex(e.target.value)} placeholder="senior, manager" />
        </label>
      </div>

      <fieldset className="space-y-1">
        <legend className="text-sm font-medium">Work mode</legend>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {REMOTE_OPTIONS.map((o) => (
            <label key={o.value} className="flex items-center gap-1.5">
              <input type="checkbox" checked={remote.includes(o.value)} onChange={() => setRemote(toggle(remote, o.value))} />
              {o.label}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-1">
        <legend className="text-sm font-medium">Sources</legend>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {SOURCE_OPTIONS.map((s) => (
            <label key={s} className="flex items-center gap-1.5">
              <input type="checkbox" checked={sources.includes(s)} onChange={() => setSources(toggle(sources, s))} />
              {s}
            </label>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">None ticked means all sources.</p>
      </fieldset>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={startup} onChange={(e) => setStartup(e.target.checked)} />
          Startups only
        </label>
        {startup && (
          <label className="flex items-center gap-1.5">
            under
            <input
              type="number"
              min={1}
              className="w-20 rounded-md border bg-background px-2 py-1"
              value={startupMax}
              placeholder="50"
              onChange={(e) => setStartupMax(e.target.value)}
            />
            listings on the company&apos;s board
          </label>
        )}
      </div>

      <p className="text-sm text-muted-foreground">Shows: {describeFilter(current)}</p>

      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" disabled={props.saving} className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-50">
          {props.saving ? "Saving…" : props.submitLabel}
        </button>
        <button type="button" className={button} onClick={props.onCancel}>
          Cancel
        </button>
        {error && <span className="text-sm text-destructive">{error}</span>}
      </div>
    </form>
  );
}
