"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useSuspenseQuery } from "@apollo/client/react";
import { BOARDS_QUERY } from "./board-queries";
import { boardToFilters, EMPTY_FILTERS } from "./filters";

/** The active board (from ?board=) and its saved filter. No board means All: no filter. */
export function useFeedFilters() {
  const sp = useSearchParams();
  const { data } = useSuspenseQuery(BOARDS_QUERY);
  const board = data.boards.find((b) => b.id === sp.get("board")) ?? null;
  const filters = useMemo(() => (board ? boardToFilters(board.filter) : EMPTY_FILTERS), [board]);
  return { boards: data.boards, board, filters };
}
