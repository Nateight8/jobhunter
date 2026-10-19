import { and, count, desc, eq, sql } from "drizzle-orm";
import { applications, companies, jobs } from "@workspace/db";
import type { Db } from "../../lib/db";
import { ValidationError } from "../../lib/errors";
import { isUuid } from "../../lib/pagination";
import { str } from "../../lib/validate";
import { boardJoin, jobColumns, type JobRow } from "../jobs/jobs.service";

export const APPLICATION_STATUSES = ["saved", "applied", "interviewing", "offer", "rejected", "hidden"] as const;
export type ApplicationStatusValue = (typeof APPLICATION_STATUSES)[number];

// Moving into any of these stamps applied_at (once; it is never overwritten).
const APPLIED_LIKE = new Set<string>(["applied", "interviewing", "offer", "rejected"]);

export type ApplicationRow = {
  id: string;
  status: string;
  appliedAt: Date | null;
  notes: string | null;
  updatedAt: Date;
  job: JobRow;
};

const base = (db: Db) =>
  db
    .select({
      id: applications.id,
      status: applications.status,
      appliedAt: applications.appliedAt,
      notes: applications.notes,
      updatedAt: applications.updatedAt,
      job: jobColumns,
    })
    .from(applications)
    .innerJoin(jobs, eq(jobs.id, applications.jobId))
    .leftJoin(companies, boardJoin);

export async function listApplications(
  db: Db,
  profileId: string,
  status?: string,
): Promise<ApplicationRow[]> {
  return base(db)
    .where(and(eq(applications.profileId, profileId), status ? eq(applications.status, status) : undefined))
    .orderBy(desc(applications.updatedAt));
}

export async function getApplication(
  db: Db,
  profileId: string,
  jobId: string,
): Promise<ApplicationRow | null> {
  if (!isUuid(jobId)) return null;
  const [row] = await base(db)
    .where(and(eq(applications.profileId, profileId), eq(applications.jobId, jobId)))
    .limit(1);
  return row ?? null;
}

export async function applicationCounts(db: Db, profileId: string) {
  return db
    .select({ status: applications.status, count: count() })
    .from(applications)
    .where(eq(applications.profileId, profileId))
    .groupBy(applications.status);
}

export async function setApplicationStatus(
  db: Db,
  profileId: string,
  jobId: string,
  status: string,
  notes?: string | null,
): Promise<ApplicationRow> {
  if (!isUuid(jobId)) throw new ValidationError("Job not found");
  if (!(APPLICATION_STATUSES as readonly string[]).includes(status)) {
    throw new ValidationError("Unknown status");
  }
  const [job] = await db.select({ id: jobs.id }).from(jobs).where(eq(jobs.id, jobId));
  if (!job) throw new ValidationError("Job not found");

  const cleanNotes = notes === undefined ? undefined : str("notes", notes, 4000);
  const appliedLike = APPLIED_LIKE.has(status);

  await db
    .insert(applications)
    .values({
      profileId,
      jobId,
      status,
      notes: cleanNotes ?? null,
      appliedAt: appliedLike ? new Date() : null,
    })
    .onConflictDoUpdate({
      target: [applications.profileId, applications.jobId],
      set: {
        status,
        updatedAt: new Date(),
        ...(cleanNotes !== undefined ? { notes: cleanNotes } : {}),
        ...(appliedLike ? { appliedAt: sql`coalesce(${applications.appliedAt}, now())` } : {}),
      },
    });

  return (await getApplication(db, profileId, jobId))!;
}

export async function setApplicationNotes(
  db: Db,
  profileId: string,
  jobId: string,
  notes: string | null,
): Promise<ApplicationRow> {
  if (!isUuid(jobId)) throw new ValidationError("Job not found");
  const res = await db
    .update(applications)
    .set({ notes: str("notes", notes, 4000) ?? null, updatedAt: new Date() })
    .where(and(eq(applications.profileId, profileId), eq(applications.jobId, jobId)))
    .returning({ id: applications.id });
  if (res.length === 0) throw new ValidationError("Save or apply to this job first");
  return (await getApplication(db, profileId, jobId))!;
}

export async function removeApplication(db: Db, profileId: string, jobId: string): Promise<void> {
  if (!isUuid(jobId)) throw new ValidationError("Job not found");
  await db
    .delete(applications)
    .where(and(eq(applications.profileId, profileId), eq(applications.jobId, jobId)));
}
