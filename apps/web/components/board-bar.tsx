"use client";

import { useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@apollo/client/react";
import {
  BOARD_COUNTS_QUERY,
  BOARD_PRESETS_QUERY,
  BOARDS_QUERY,
  CREATE_BOARD_MUTATION,
  REGION_OPTIONS_QUERY,
} from "../lib/board-queries";
import { boardToFilters, describeFilter, filtersToBoardInput } from "../lib/filters";
import { useFeedFilters } from "../lib/use-feed-filters";

const tab = "whitespace-nowrap rounded-md border px-3 py-1.5 text-sm";

export function BoardBar() {
  const router = useRouter();
  const { boards, board: active } = useFeedFilters();
  const { data: counts } = useQuery(BOARD_COUNTS_QUERY);
  const { data: presetData } = useQuery(BOARD_PRESETS_QUERY);
  const { data: regionData } = useQuery(REGION_OPTIONS_QUERY);
  const [createBoard] = useMutation(CREATE_BOARD_MUTATION, {
    refetchQueries: [BOARDS_QUERY, BOARD_COUNTS_QUERY],
  });
  const menu = useRef<HTMLDetailsElement>(null);
  const names = Object.fromEntries((regionData?.regionOptions ?? []).map((o) => [o.code, o.name]));

  const countOf = (id: string) => {
    const c = counts?.boards.find((b) => b.id === id)?.count;
    return c ? ` ${c.value}${c.capped ? "+" : ""}` : "";
  };

  async function add(name: string, filter: Parameters<typeof boardToFilters>[0] | null) {
    menu.current?.removeAttribute("open");
    const res = await createBoard({
      variables: { name, filter: filter ? filtersToBoardInput(boardToFilters(filter)) : null },
    });
    const id = res.data?.createBoard.id;
    if (id) router.push(`/?board=${id}`);
  }

  return (
    <div>
      <div className="flex items-center gap-2">
        {/* tabs scroll sideways; the + menu sits outside so its dropdown is never clipped */}
        <nav className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto">
          <Link href="/" className={`${tab} ${active ? "hover:bg-muted" : "bg-muted font-medium"}`}>
            All
          </Link>
          {boards.map((b) => (
            <Link
              key={b.id}
              href={`/?board=${b.id}`}
              className={`${tab} ${b.id === active?.id ? "bg-muted font-medium" : "hover:bg-muted"}`}
            >
              {b.name}
              <span className="text-muted-foreground">{countOf(b.id)}</span>
            </Link>
          ))}
          {!boards.some((b) => b.kind === "recommended") && (
            <Link href="/boards" className={`${tab} text-muted-foreground hover:bg-muted`}>
              Get recommendations
            </Link>
          )}
        </nav>
        <details ref={menu} className="relative shrink-0">
          <summary className={`${tab} cursor-pointer list-none hover:bg-muted`}>+</summary>
          <div className="absolute right-0 z-20 mt-1 w-64 space-y-1 rounded-md border bg-background p-2 shadow">
            <button
              type="button"
              className="block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
              onClick={() => void add("New board", null)}
            >
              Blank board
            </button>
            {presetData?.boardPresets.map((p) => (
              <button
                key={p.id}
                type="button"
                title={p.description}
                className="block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
                onClick={() => void add(p.name, p.filter)}
              >
                {p.name}
                <span className="block text-xs text-muted-foreground">{p.description}</span>
              </button>
            ))}
            <Link href="/boards" className="block rounded px-2 py-1.5 text-sm underline">
              Manage boards
            </Link>
          </div>
        </details>
      </div>
      {active && (
        <p className="flex items-center gap-2 pt-2 text-xs text-muted-foreground">
          <span className="min-w-0 flex-1 truncate">{describeFilter(boardToFilters(active.filter), names)}</span>
          <Link href={`/boards?edit=${active.id}`} className="shrink-0 underline">
            Edit board
          </Link>
        </p>
      )}
    </div>
  );
}
