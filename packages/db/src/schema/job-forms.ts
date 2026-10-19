import { index, jsonb, pgTable, text, unique, uuid } from "drizzle-orm/pg-core";
import { tz } from "./_shared";
import { jobs } from "./jobs";
import { profiles } from "./profile";

// Public data fetched on demand by the API (not by the pipeline): a posting's application questions.
export const jobForms = pgTable("job_forms", {
  jobId: uuid("job_id")
    .primaryKey()
    .references(() => jobs.id, { onDelete: "cascade" }),
  form: jsonb("form").notNull(),
  fetchedAt: tz("fetched_at").notNull().defaultNow(),
});

// Personal: the profile's planned answer for one question on one job.
// source: you | memory | suggested. status: accepted | suggested (suggested = proposed by the assistant, not yet approved).
export const jobAnswers = pgTable(
  "job_answers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    fieldName: text("field_name").notNull(),
    label: text("label").notNull(),
    answer: text("answer").notNull(),
    source: text("source").notNull().default("you"),
    status: text("status").notNull().default("accepted"),
    createdAt: tz("created_at").notNull().defaultNow(),
    updatedAt: tz("updated_at").notNull().defaultNow(),
  },
  (t) => [
    unique("job_answers_unique").on(t.profileId, t.jobId, t.fieldName),
    index("job_answers_job_idx").on(t.profileId, t.jobId),
  ],
);

export type JobAnswer = typeof jobAnswers.$inferSelect;
