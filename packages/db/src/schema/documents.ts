import { boolean, integer, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { bytea, tz } from "./_shared";
import { profiles } from "./profile";

// Metadata only, so listing documents never loads file contents.
export const documents = pgTable(
  "documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(), // cv | cover_letter | other
    filename: text("filename").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: tz("created_at").notNull().defaultNow(),
  },
  (t) => [
    // at most one default document per kind
    uniqueIndex("documents_default_per_kind")
      .on(t.profileId, t.kind)
      .where(sql`${t.isDefault}`),
  ],
);

export const documentFiles = pgTable("document_files", {
  documentId: uuid("document_id")
    .primaryKey()
    .references(() => documents.id, { onDelete: "cascade" }),
  content: bytea("content").notNull(),
});

export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;
