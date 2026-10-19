import { and, desc, eq } from "drizzle-orm";
import { answers, type Answer } from "@workspace/db";
import type { Db } from "../../lib/db";
import { ValidationError } from "../../lib/errors";
import { isUuid } from "../../lib/pagination";
import { requiredStr, str } from "../../lib/validate";

type Maybe<T> = T | null | undefined;

const MAX_ENTRIES = 200;
const TYPES = ["text", "yesno"];

/** Lowercase, letters and digits only, single spaces. Spots the same question worded the same way. */
export function normalizeQuestion(q: string): string {
  return q
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanAnswer(type: string, v: Maybe<string>): string {
  const s = str("answer", v, 2000);
  if (!s) throw new ValidationError("An answer is required");
  if (type === "yesno") {
    const lower = s.toLowerCase();
    if (lower === "yes") return "Yes";
    if (lower === "no") return "No";
    throw new ValidationError("A yes/no answer must be Yes or No");
  }
  return s;
}

export const listMemory = (db: Db, profileId: string): Promise<Answer[]> =>
  db.select().from(answers).where(eq(answers.profileId, profileId)).orderBy(desc(answers.updatedAt));

/** Adds an entry, or edits one. Saving a question already in memory updates it rather than duplicating it. */
export async function saveMemoryEntry(
  db: Db,
  profileId: string,
  input: { id?: Maybe<string>; question: string; answerType: string; answer: string },
): Promise<Answer> {
  const question = requiredStr("question", input.question, 300);
  if (!TYPES.includes(input.answerType)) throw new ValidationError("Unknown answer type");
  const answer = cleanAnswer(input.answerType, input.answer);

  const all = await db.select().from(answers).where(eq(answers.profileId, profileId));
  const normalized = normalizeQuestion(question);

  let target: Answer | undefined;
  if (input.id) {
    if (!isUuid(input.id)) throw new ValidationError("Memory entry not found");
    target = all.find((a) => a.id === input.id);
    if (!target) throw new ValidationError("Memory entry not found");
    if (all.some((a) => a.id !== target!.id && normalizeQuestion(a.question) === normalized)) {
      throw new ValidationError("You already have an answer to this question");
    }
  } else {
    target = all.find((a) => normalizeQuestion(a.question) === normalized);
    if (!target && all.length >= MAX_ENTRIES) {
      throw new ValidationError(`Memory is full (max ${MAX_ENTRIES}). Delete some entries first.`);
    }
  }

  if (target) {
    const [row] = await db
      .update(answers)
      .set({ question, answerType: input.answerType, answer })
      .where(and(eq(answers.id, target.id), eq(answers.profileId, profileId)))
      .returning();
    return row!;
  }
  const [row] = await db
    .insert(answers)
    .values({ profileId, question, answerType: input.answerType, answer, position: 0 })
    .returning();
  return row!;
}

export async function deleteMemoryEntry(db: Db, profileId: string, id: string): Promise<Answer[]> {
  if (!isUuid(id)) throw new ValidationError("Memory entry not found");
  const res = await db
    .delete(answers)
    .where(and(eq(answers.id, id), eq(answers.profileId, profileId)))
    .returning({ id: answers.id });
  if (res.length === 0) throw new ValidationError("Memory entry not found");
  return listMemory(db, profileId);
}
