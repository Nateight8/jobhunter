import { boolean, integer, pgTable, text, unique, uuid } from "drizzle-orm/pg-core";
import { tz } from "./_shared";

export const companies = pgTable(
  "companies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    domain: text("domain").unique(),
    atsType: text("ats_type"), // greenhouse | lever | ashby | null
    atsSlug: text("ats_slug"),
    enabled: boolean("enabled").notNull().default(true),
    failCount: integer("fail_count").notNull().default(0), // consecutive failures
    lastScrapedAt: tz("last_scraped_at"),
    openJobs: integer("open_jobs"), // board size at last successful scrape
    lastError: text("last_error"),
    createdAt: tz("created_at").notNull().defaultNow(),
  },
  (t) => [unique("companies_ats_unique").on(t.atsType, t.atsSlug)],
);

export type Company = typeof companies.$inferSelect;
export type NewCompany = typeof companies.$inferInsert;
