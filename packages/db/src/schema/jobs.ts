import {
  bigint,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { tz } from "./_shared";
import { companies } from "./companies";

export const jobs = pgTable(
  "jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    source: text("source").notNull(),
    sourceId: text("source_id").notNull(),
    url: text("url").notNull(),
    applyUrl: text("apply_url"),

    title: text("title").notNull(),
    companyName: text("company_name").notNull(),
    companyId: uuid("company_id").references(() => companies.id, {
      onDelete: "set null",
    }),

    location: text("location"),
    remoteType: text("remote_type").notNull().default("unknown"), // remote | hybrid | onsite | unknown
    description: text("description"),

    salaryMin: bigint("salary_min", { mode: "number" }),
    salaryMax: bigint("salary_max", { mode: "number" }),
    salaryCurrency: text("salary_currency"),
    salaryPeriod: text("salary_period"), // year | month | hour

    postedAt: tz("posted_at"),
    firstSeenAt: tz("first_seen_at").notNull().defaultNow(),
    lastSeenAt: tz("last_seen_at").notNull().defaultNow(),
    closedAt: tz("closed_at"),

    dedupeKey: text("dedupe_key").notNull(),
    status: text("status").notNull().default("unverified"), // verified | likely | unverified | ghost
    score: integer("score"),
    // Canonical region codes (see shared/regions.json). Null = not classified. Written by `jobhunter enrich`.
    regions: text("regions").array(),

    raw: jsonb("raw"),
  },
  (t) => [
    unique("jobs_source_unique").on(t.source, t.sourceId),
    index("jobs_dedupe_key_idx").on(t.dedupeKey),
    index("jobs_company_id_idx").on(t.companyId),
    index("jobs_status_idx").on(t.status),
    index("jobs_last_seen_idx").on(t.lastSeenAt),
    index("jobs_regions_idx").using("gin", t.regions),
  ],
);

export type Job = typeof jobs.$inferSelect;
export type NewJob = typeof jobs.$inferInsert;
