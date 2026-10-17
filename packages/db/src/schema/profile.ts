import {
  date,
  index,
  integer,
  jsonb,
  boolean,
  pgTable,
  text,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { tz } from "./_shared";

// One row for now (single user, no login). Identity fields are nullable until the
// user confirms a CV review; `readiness` in the API reports what is still missing.
export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey().defaultRandom(),

  fullName: text("full_name"),
  email: text("email"),
  phone: text("phone"),
  headline: text("headline"),
  summary: text("summary"),

  city: text("city"),
  country: text("country"), // country of residence
  timezone: text("timezone"),

  linkedinUrl: text("linkedin_url"),
  githubUrl: text("github_url"),
  portfolioUrl: text("portfolio_url"),
  links: jsonb("links").$type<{ label: string; url: string }[]>().notNull().default([]),

  yearsExperience: integer("years_experience"),
  // Regions the user can work in without visa sponsorship, e.g. ["NG", "Africa"]
  authorizedRegions: text("authorized_regions").array().notNull().default([]),

  confirmedAt: tz("confirmed_at"), // set when the user confirms the CV review
  createdAt: tz("created_at").notNull().defaultNow(),
  updatedAt: tz("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

const profileId = () =>
  uuid("profile_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" });

export const experiences = pgTable(
  "experiences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: profileId(),
    position: integer("position").notNull().default(0),
    company: text("company").notNull(),
    title: text("title").notNull(),
    location: text("location"),
    startDate: date("start_date", { mode: "string" }), // month precision, stored as YYYY-MM-01
    endDate: date("end_date", { mode: "string" }),
    isCurrent: boolean("is_current").notNull().default(false),
    bullets: text("bullets").array().notNull().default([]),
    technologies: text("technologies").array().notNull().default([]),
  },
  (t) => [index("experiences_profile_idx").on(t.profileId)],
);

export const education = pgTable(
  "education",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: profileId(),
    position: integer("position").notNull().default(0),
    school: text("school").notNull(),
    degree: text("degree"),
    field: text("field"),
    startDate: date("start_date", { mode: "string" }),
    endDate: date("end_date", { mode: "string" }),
  },
  (t) => [index("education_profile_idx").on(t.profileId)],
);

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: profileId(),
    position: integer("position").notNull().default(0),
    name: text("name").notNull(),
    url: text("url"),
    description: text("description"),
    bullets: text("bullets").array().notNull().default([]),
    technologies: text("technologies").array().notNull().default([]),
  },
  (t) => [index("projects_profile_idx").on(t.profileId)],
);

export const skills = pgTable(
  "skills",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: profileId(),
    position: integer("position").notNull().default(0),
    name: text("name").notNull(),
    category: text("category"),
  },
  (t) => [unique("skills_profile_name_unique").on(t.profileId, t.name)],
);

export type Profile = typeof profiles.$inferSelect;
export type NewProfile = typeof profiles.$inferInsert;
export type Experience = typeof experiences.$inferSelect;
export type Education = typeof education.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type Skill = typeof skills.$inferSelect;
