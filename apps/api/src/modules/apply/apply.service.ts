import { and, desc, eq, inArray } from "drizzle-orm";
import {
  applications,
  applyRunFiles,
  applyRuns,
  documents,
  jobs,
  type ApplyRun,
  type Profile,
} from "@workspace/db";
import type { Db } from "../../lib/db";
import { ValidationError } from "../../lib/errors";
import { isUuid } from "../../lib/pagination";

export const ACTIVE_STATUSES = ["queued", "opening", "filling", "needs_you"];
const APPLIED_LIKE = ["applied", "interviewing", "offer", "rejected"];

export type Outcome = {
  key: string;
  label: string;
  required: boolean;
  state: "filled" | "check" | "left" | "failed";
  note?: string;
};
export type Report = { outcomes: Outcome[] };

/** Queues an auto-fill run. The runner process picks it up; this never opens a browser itself. */
export async function startApply(db: Db, profile: Profile, jobId: string): Promise<ApplyRun> {
  if (!isUuid(jobId)) throw new ValidationError("Job not found");
  const [job] = await db
    .select({ id: jobs.id, source: jobs.source, closedAt: jobs.closedAt })
    .from(jobs)
    .where(eq(jobs.id, jobId));
  if (!job) throw new ValidationError("Job not found");
  if (job.source !== "greenhouse") throw new ValidationError("Auto-fill works for Greenhouse jobs only so far.");
  if (job.closedAt) throw new ValidationError("This listing has closed.");
  if (!profile.fullName || !profile.email) {
    throw new ValidationError("Finish your profile first: the form needs your name and email.");
  }

  const [cv] = await db
    .select({ id: documents.id })
    .from(documents)
    .where(and(eq(documents.profileId, profile.id), eq(documents.kind, "cv"), eq(documents.isDefault, true)))
    .limit(1);
  if (!cv) throw new ValidationError("Upload your CV on the profile page first.");

  const [existing] = await db
    .select()
    .from(applyRuns)
    .where(
      and(
        eq(applyRuns.profileId, profile.id),
        eq(applyRuns.jobId, jobId),
        inArray(applyRuns.status, ACTIVE_STATUSES),
      ),
    )
    .limit(1);
  if (existing) return existing;

  const [app] = await db
    .select({ status: applications.status })
    .from(applications)
    .where(and(eq(applications.profileId, profile.id), eq(applications.jobId, jobId)));
  if (app && APPLIED_LIKE.includes(app.status)) {
    throw new ValidationError("You've already applied to this job. Remove it from your tracker to run this again.");
  }

  const [run] = await db
    .insert(applyRuns)
    .values({ profileId: profile.id, jobId, status: "queued" })
    .returning();
  return run!;
}

export async function latestRun(db: Db, profileId: string, jobId: string): Promise<ApplyRun | null> {
  if (!isUuid(jobId)) return null;
  const [run] = await db
    .select()
    .from(applyRuns)
    .where(and(eq(applyRuns.profileId, profileId), eq(applyRuns.jobId, jobId)))
    .orderBy(desc(applyRuns.createdAt))
    .limit(1);
  return run ?? null;
}

export async function hasScreenshot(db: Db, runId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: applyRunFiles.runId })
    .from(applyRunFiles)
    .where(eq(applyRunFiles.runId, runId));
  return !!row;
}

export async function getScreenshot(db: Db, runId: string) {
  const [row] = await db
    .select({ mimeType: applyRunFiles.mimeType, content: applyRunFiles.content })
    .from(applyRunFiles)
    .where(eq(applyRunFiles.runId, runId));
  return row ?? null;
}
