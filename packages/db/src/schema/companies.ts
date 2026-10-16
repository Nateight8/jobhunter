import { pgTable, text, unique, uuid } from "drizzle-orm/pg-core";
import { tz } from "./_shared";

export const companies = pgTable(
  "companies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    domain: text("domain").unique(),
    atsType: text("ats_type"), // greenhouse | lever | ashby | null
    atsSlug: text("ats_slug"),
    createdAt: tz("created_at").notNull().defaultNow(),
  },
  (t) => [unique("companies_ats_unique").on(t.atsType, t.atsSlug)],
);

export type Company = typeof companies.$inferSelect;
export type NewCompany = typeof companies.$inferInsert;
