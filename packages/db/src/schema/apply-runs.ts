import { index, jsonb, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { bytea, tz } from "./_shared";
import { jobs } from "./jobs";
import { profiles } from "./profile";

// One row per "auto-fill this application" request. The API queues it; the runner process does the work.
// status: queued | opening | filling | needs_you | submitted | closed | failed | abandoned
export const applyRuns = pgTable(
  "apply_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("queued"),
    message: text("message"),
    report: jsonb("report"), // { outcomes: [{ key, label, required, state, note }] }
    log: jsonb("log").notNull().default([]), // [{ at, text }]
    createdAt: tz("created_at").notNull().defaultNow(),
    updatedAt: tz("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("apply_runs_job_idx").on(t.profileId, t.jobId, t.createdAt),
    index("apply_runs_status_idx").on(t.status),
  ],
);

// Proof of submission: a screenshot of the confirmation page. Kept apart so listing runs never loads it.
export const applyRunFiles = pgTable("apply_run_files", {
  runId: uuid("run_id")
    .primaryKey()
    .references(() => applyRuns.id, { onDelete: "cascade" }),
  mimeType: text("mime_type").notNull(),
  content: bytea("content").notNull(),
  createdAt: tz("created_at").notNull().defaultNow(),
});

export type ApplyRun = typeof applyRuns.$inferSelect;
