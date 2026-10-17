import { index, jsonb, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { tz } from "./_shared";
import { documents } from "./documents";
import { profiles } from "./profile";

// Result of CV extraction, saved so a page refresh never costs another AI call.
// Nothing reaches the profile tables until the user confirms the review.
export const profileDrafts = pgTable(
  "profile_drafts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    documentId: uuid("document_id").references(() => documents.id, { onDelete: "set null" }),
    status: text("status").notNull().default("pending"), // pending | ready | failed | confirmed | discarded
    data: jsonb("data"), // extracted profile, validated against the extraction schema
    model: text("model"),
    error: text("error"),
    createdAt: tz("created_at").notNull().defaultNow(),
    updatedAt: tz("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("profile_drafts_profile_idx").on(t.profileId)],
);

export type ProfileDraft = typeof profileDrafts.$inferSelect;
