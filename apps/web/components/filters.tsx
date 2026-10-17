"use client";

import type { FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { REMOTE_OPTIONS, readFilters } from "../lib/filters";

const input = "w-full rounded-md border bg-background px-3 py-2 text-sm";

export function Filters() {
  const router = useRouter();
  const sp = useSearchParams();
  const f = readFilters(sp);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const next = new URLSearchParams();
    const q = String(fd.get("q") ?? "").trim();
    const stack = String(fd.get("stack") ?? "").trim();
    const remote = fd.getAll("remote").map(String);
    if (q) next.set("q", q);
    if (stack) next.set("stack", stack);
    if (remote.length) next.set("remote", remote.join(","));
    if (fd.get("startup")) next.set("startup", "1");
    router.replace(`?${next.toString()}`, { scroll: false });
  }

  return (
    // key resets the uncontrolled inputs when the URL changes (back button, links)
    <form key={sp.toString()} onSubmit={onSubmit} className="space-y-3">
      <input name="q" defaultValue={f.q} placeholder="Search title or company" className={input} />
      <input
        name="stack"
        defaultValue={f.stack.join(", ")}
        placeholder="Stack: react, node, python"
        className={input}
      />
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {REMOTE_OPTIONS.map((o) => (
          <label key={o.value} className="flex items-center gap-1.5">
            <input
              type="checkbox"
              name="remote"
              value={o.value}
              defaultChecked={f.remote.includes(o.value)}
            />
            {o.label}
          </label>
        ))}
        <label className="flex items-center gap-1.5">
          <input type="checkbox" name="startup" defaultChecked={f.startup} />
          Startups only
        </label>
      </div>
      <button
        type="submit"
        className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground"
      >
        Apply filters
      </button>
    </form>
  );
}
