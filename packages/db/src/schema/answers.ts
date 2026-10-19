import { index, integer, pgTable, text, unique, uuid } from "drizzle-orm/pg-core";
import { tz } from "./_shared";
import { profiles } from "./profile";

// Reusable answers to questions that recur in application forms. Empty = never guessed.
export const answers = pgTable(
  "answers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    key: text("key"), // starter questions have a key; your own questions have none
    question: text("question").notNull(),
    answerType: text("answer_type").notNull().default("text"), // text | yesno
    answer: text("answer"),
    position: integer("position").notNull().default(0),
    createdAt: tz("created_at").notNull().defaultNow(),
    updatedAt: tz("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    unique("answers_profile_key_unique").on(t.profileId, t.key), // keys are unique; many NULL keys are fine
    index("answers_profile_idx").on(t.profileId, t.position),
  ],
);

export type Answer = typeof answers.$inferSelect;
