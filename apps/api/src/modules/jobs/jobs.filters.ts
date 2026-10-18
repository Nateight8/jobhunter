import { arrayOverlaps, ilike, inArray, isNull, or, sql, type SQL } from "drizzle-orm";
import { companies, jobs } from "@workspace/db";

export type JobFilterInput = {
  search?: string | null;
  stack?: string[] | null;
  remoteTypes?: string[] | null;
  sources?: string[] | null;
  startupOnly?: boolean | null;
  startupMaxBoardSize?: number | null;
  includeClosed?: boolean | null;
  titleIncludes?: string[] | null;
  titleExcludes?: string[] | null;
  regions?: string[] | null;
};

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const escapeLike = (s: string) => s.replace(/[%_\\]/g, "\\$&");

// Whole word, case-insensitive: "go" matches "Go developer" but not "good".
const wholeWord = (k: string) => `(^|[^a-z0-9])${escapeRegex(k.trim().toLowerCase())}($|[^a-z0-9])`;
const clean = (a?: string[] | null) => (a ?? []).map((s) => s.trim()).filter(Boolean);

/** Turns a filter input into SQL conditions. Expects `companies` to be joined. */
export function buildConditions(f: JobFilterInput): SQL[] {
  const conds: SQL[] = [];
  if (!f.includeClosed) conds.push(isNull(jobs.closedAt));
  if (f.remoteTypes?.length) conds.push(inArray(jobs.remoteType, f.remoteTypes));
  if (f.sources?.length) conds.push(inArray(jobs.source, f.sources));

  if (f.search?.trim()) {
    const p = `%${escapeLike(f.search.trim())}%`;
    conds.push(or(ilike(jobs.title, p), ilike(jobs.companyName, p))!);
  }

  const stack = clean(f.stack);
  if (stack.length) {
    // Any keyword, in the title or the description.
    const terms = stack.map((k) => {
      const re = wholeWord(k);
      return or(sql`${jobs.title} ~* ${re}`, sql`${jobs.description} ~* ${re}`)!;
    });
    conds.push(or(...terms)!);
  }

  const includes = clean(f.titleIncludes);
  if (includes.length) {
    conds.push(or(...includes.map((k) => sql`${jobs.title} ~* ${wholeWord(k)}`))!);
  }
  for (const k of clean(f.titleExcludes)) {
    conds.push(sql`${jobs.title} !~* ${wholeWord(k)}`);
  }

  const regions = clean(f.regions);
  if (regions.length) conds.push(arrayOverlaps(jobs.regions, regions)); // any of the picked regions

  if (f.startupOnly) {
    // Only jobs from a known ATS board can be size-checked; others are excluded.
    conds.push(sql`${companies.openJobs} < ${f.startupMaxBoardSize ?? 50}`);
  }
  return conds;
}
