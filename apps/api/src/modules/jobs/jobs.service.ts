import { and, count, desc, eq, sql } from "drizzle-orm";
import { companies, jobs } from "@workspace/db";
import type { Db } from "../../lib/db";
import { clampFirst, decodeCursor, encodeCursor, isUuid } from "../../lib/pagination";
import { buildConditions, type JobFilterInput } from "./jobs.filters";

export type JobRow = {
  id: string;
  source: string;
  url: string;
  applyUrl: string | null;
  title: string;
  companyName: string;
  location: string | null;
  remoteType: string;
  status: string;
  score: number | null;
  postedAt: Date | null;
  firstSeenAt: Date;
  closedAt: Date | null;
  boardSize: number | null; // open jobs on the company's ATS board (startup-size signal)
  cursorTs: string; // full-precision timestamp for keyset pagination
  description?: string | null; // only loaded by getJob, never in lists
};

const columns = {
  id: jobs.id,
  source: jobs.source,
  url: jobs.url,
  applyUrl: jobs.applyUrl,
  title: jobs.title,
  companyName: jobs.companyName,
  location: jobs.location,
  remoteType: jobs.remoteType,
  status: jobs.status,
  score: jobs.score,
  postedAt: jobs.postedAt,
  firstSeenAt: jobs.firstSeenAt,
  closedAt: jobs.closedAt,
  boardSize: companies.openJobs,
  cursorTs: sql<string>`${jobs.firstSeenAt}::text`,
};

// jobs.company_id isn't resolved yet, so join to the board by (source, slug).
const boardJoin = and(
  eq(companies.atsType, jobs.source),
  eq(companies.atsSlug, sql`split_part(${jobs.sourceId}, ':', 1)`),
);

export async function listJobs(
  db: Db,
  args: { filter: JobFilterInput; first: number; after?: string | null },
) {
  const first = clampFirst(args.first);
  const conds = buildConditions(args.filter);

  const pageConds = [...conds];
  if (args.after) {
    const { ts, id } = decodeCursor(args.after);
    pageConds.push(sql`(${jobs.firstSeenAt}, ${jobs.id}) < (${ts}::timestamptz, ${id}::uuid)`);
  }

  const [rows, totals] = await Promise.all([
    db
      .select(columns)
      .from(jobs)
      .leftJoin(companies, boardJoin)
      .where(and(...pageConds))
      .orderBy(desc(jobs.firstSeenAt), desc(jobs.id))
      .limit(first + 1),
    db.select({ n: count() }).from(jobs).leftJoin(companies, boardJoin).where(and(...conds)),
  ]);

  const edges = rows
    .slice(0, first)
    .map((node) => ({ cursor: encodeCursor(node.cursorTs, node.id), node }));
  return {
    edges,
    totalCount: totals[0]?.n ?? 0,
    pageInfo: { hasNextPage: rows.length > first, endCursor: edges.at(-1)?.cursor ?? null },
  };
}

export async function getJob(db: Db, id: string): Promise<JobRow | null> {
  if (!isUuid(id)) return null;
  const rows = await db
    .select({ ...columns, description: jobs.description })
    .from(jobs)
    .leftJoin(companies, boardJoin)
    .where(eq(jobs.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function getJobDescription(db: Db, id: string): Promise<string | null> {
  const [row] = await db.select({ d: jobs.description }).from(jobs).where(eq(jobs.id, id));
  return row?.d ?? null;
}
