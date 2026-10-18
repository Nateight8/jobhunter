import { z } from "zod";
import { int, list, str } from "../../lib/validate";
import type { JobFilterInput } from "../jobs/jobs.filters";

const REMOTE = ["remote", "hybrid", "onsite", "unknown"] as const;

export type BoardFilter = {
  search?: string;
  stack?: string[];
  remoteTypes?: (typeof REMOTE)[number][];
  sources?: string[];
  startupOnly?: boolean;
  startupMaxBoardSize?: number;
  titleIncludes?: string[];
  titleExcludes?: string[];
};

export type BoardFilterInputShape = {
  search?: string | null;
  stack?: string[] | null;
  remoteTypes?: string[] | null;
  sources?: string[] | null;
  startupOnly?: boolean | null;
  startupMaxBoardSize?: number | null;
  titleIncludes?: string[] | null;
  titleExcludes?: string[] | null;
};

// Reading is permissive: a bad or unknown field becomes "not set", never an error.
const strings = z.array(z.string()).optional().catch(undefined);
const READ = z
  .object({
    search: z.string().optional().catch(undefined),
    stack: strings,
    remoteTypes: z.array(z.enum(REMOTE)).optional().catch(undefined),
    sources: strings,
    startupOnly: z.boolean().optional().catch(undefined),
    startupMaxBoardSize: z.number().int().optional().catch(undefined),
    titleIncludes: strings,
    titleExcludes: strings,
  })
  .catch({});

export const parseFilter = (raw: unknown): BoardFilter => READ.parse(raw ?? {}) as BoardFilter;

/** Writing is strict: validated, trimmed, empties dropped. */
export function normalizeFilter(f: BoardFilterInputShape | null | undefined): BoardFilter {
  const out: BoardFilter = {};

  const search = str("search", f?.search, 200);
  if (search) out.search = search;

  const stack = list("stack", f?.stack, 20, 60);
  if (stack.length) out.stack = stack;

  const remote = [...new Set(f?.remoteTypes ?? [])].filter((r): r is (typeof REMOTE)[number] =>
    (REMOTE as readonly string[]).includes(r),
  );
  if (remote.length) out.remoteTypes = remote;

  const sources = list("sources", f?.sources, 10, 30);
  if (sources.length) out.sources = sources;

  if (f?.startupOnly) {
    out.startupOnly = true;
    const max = int("startupMaxBoardSize", f.startupMaxBoardSize, 1, 10000);
    if (max) out.startupMaxBoardSize = max;
  }

  const includes = list("titleIncludes", f?.titleIncludes, 20, 60);
  if (includes.length) out.titleIncludes = includes;
  const excludes = list("titleExcludes", f?.titleExcludes, 20, 60);
  if (excludes.length) out.titleExcludes = excludes;

  return out;
}

export const toJobFilter = (f: BoardFilter): JobFilterInput => ({ ...f });
