import { integer, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { tz } from "./_shared";

export const scrapeRuns = pgTable("scrape_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  source: text("source").notNull(),
  startedAt: tz("started_at").notNull().defaultNow(),
  finishedAt: tz("finished_at"),
  jobsSeen: integer("jobs_seen").notNull().default(0),
  jobsNew: integer("jobs_new").notNull().default(0),
  error: text("error"),
});

export type ScrapeRun = typeof scrapeRuns.$inferSelect;
export type NewScrapeRun = typeof scrapeRuns.$inferInsert;
