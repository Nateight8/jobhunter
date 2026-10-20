import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { applyRuns, type ApplyRun } from "@workspace/db";
import { db } from "../lib/db";
import type { Report } from "../modules/apply/apply.service";

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export async function log(runId: string, text: string): Promise<void> {
  console.log(`[run ${runId.slice(0, 8)}] ${text}`);
  await db
    .update(applyRuns)
    .set({
      log: sql`${applyRuns.log} || ${JSON.stringify([{ at: new Date().toISOString(), text }])}::jsonb`,
      updatedAt: new Date(),
    })
    .where(eq(applyRuns.id, runId));
}

export async function setStatus(
  runId: string,
  status: string,
  message?: string | null,
  report?: Report,
): Promise<void> {
  await db
    .update(applyRuns)
    .set({
      status,
      updatedAt: new Date(),
      ...(message !== undefined ? { message } : {}),
      ...(report ? { report } : {}),
    })
    .where(eq(applyRuns.id, runId));
}

/** Takes the oldest queued run, or null. One runner process, so no locking is needed beyond the status check. */
export async function claimNext(): Promise<ApplyRun | null> {
  const [next] = await db
    .select({ id: applyRuns.id })
    .from(applyRuns)
    .where(eq(applyRuns.status, "queued"))
    .orderBy(asc(applyRuns.createdAt))
    .limit(1);
  if (!next) return null;
  const [claimed] = await db
    .update(applyRuns)
    .set({ status: "opening", updatedAt: new Date() })
    .where(and(eq(applyRuns.id, next.id), eq(applyRuns.status, "queued")))
    .returning();
  return claimed ?? null;
}

/** Runs left over from a previous runner can't be resumed: their browser windows are gone. */
export async function markStale(): Promise<void> {
  await db
    .update(applyRuns)
    .set({ status: "abandoned", message: "The runner was restarted, so this run was stopped.", updatedAt: new Date() })
    .where(inArray(applyRuns.status, ["opening", "filling", "needs_you"]));
}
