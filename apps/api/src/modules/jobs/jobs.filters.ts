import { ilike, inArray, isNull, or, sql, type SQL } from "drizzle-orm";
import { companies, jobs } from "@workspace/db";

export type JobFilterInput = {
  search?: string | null;
  stack?: string[] | null;
  remoteTypes?: string[] | null;
  sources?: string[] | null;
  startupOnly?: boolean | null;
  startupMaxBoardSize?: number | null;
  includeClosed?: boolean | null;
};

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const escapeLike = (s: string) => s.replace(/[%_\\]/g, "\\$&");

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

  if (f.stack?.length) {
    // Whole-word, case-insensitive match in title or description; any keyword.
    const terms = f.stack.map((k) => {
      const re = `(^|[^a-z0-9])${escapeRegex(k.trim().toLowerCase())}($|[^a-z0-9])`;
      return or(sql`${jobs.title} ~* ${re}`, sql`${jobs.description} ~* ${re}`)!;
    });
    conds.push(or(...terms)!);
  }

  if (f.startupOnly) {
    // Only jobs from a known ATS board can be size-checked; others are excluded.
    conds.push(sql`${companies.openJobs} < ${f.startupMaxBoardSize ?? 50}`);
  }
  return conds;
}
