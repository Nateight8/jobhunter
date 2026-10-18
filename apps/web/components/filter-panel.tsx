"use client";

import { describeFilter } from "../lib/filters";
import { useFeedFilters } from "../lib/use-feed-filters";
import { Filters } from "./filters";

// Collapsed by default so the job list stays near the top; opens while changes are unsaved.
export function FilterPanel() {
  const { filters, dirty } = useFeedFilters();
  return (
    <details open={dirty} className="rounded-md border p-3">
      <summary className="cursor-pointer text-sm">
        <span className="font-medium">Filters</span>
        <span className="text-muted-foreground"> · {describeFilter(filters)}</span>
      </summary>
      <div className="pt-3">
        <Filters />
      </div>
    </details>
  );
}
