"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useSuspenseQuery } from "@apollo/client/react";
import { BOARDS_QUERY } from "./board-queries";
import { boardToFilters, EMPTY_FILTERS, hasOverrides, readFilters } from "./filters";

/** The active board (from ?board=), its saved filter, and the filter currently applied. */
export function useFeedFilters() {
  const sp = useSearchParams();
  const { data } = useSuspenseQuery(BOARDS_QUERY);
  const board = data.boards.find((b) => b.id === sp.get("board")) ?? null;
  const base = useMemo(() => (board ? boardToFilters(board.filter) : EMPTY_FILTERS), [board]);
  return {
    sp,
    boards: data.boards,
    board,
    base,
    filters: readFilters(sp, base),
    dirty: hasOverrides(sp),
  };
}
