import { index, integer, jsonb, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { tz } from "./_shared";
import { profiles } from "./profile";

// A board is a saved search: a name plus a filter. Owned by the profile, like experience and skills.
export const boards = pgTable(
  "boards",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    position: integer("position").notNull().default(0),
    kind: text("kind"), // 'recommended' for the CV-generated board, null otherwise
    filter: jsonb("filter").notNull().default({}),
    createdAt: tz("created_at").notNull().defaultNow(),
    updatedAt: tz("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("boards_profile_idx").on(t.profileId, t.position)],
);

export type Board = typeof boards.$inferSelect;
export type NewBoard = typeof boards.$inferInsert;
