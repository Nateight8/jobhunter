import { index, pgTable, text, unique, uuid } from "drizzle-orm/pg-core";
import { tz } from "./_shared";
import { jobs } from "./jobs";
import { profiles } from "./profile";

// Personal state about a job. Lives apart from `jobs`, which is public data written by the pipeline.
export const applications = pgTable(
  "applications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    status: text("status").notNull(), // saved | applied | interviewing | offer | rejected | hidden
    appliedAt: tz("applied_at"),
    notes: text("notes"),
    createdAt: tz("created_at").notNull().defaultNow(),
    updatedAt: tz("updated_at").notNull().defaultNow(),
  },
  (t) => [
    unique("applications_profile_job_unique").on(t.profileId, t.jobId),
    index("applications_status_idx").on(t.profileId, t.status),
  ],
);

export type Application = typeof applications.$inferSelect;
