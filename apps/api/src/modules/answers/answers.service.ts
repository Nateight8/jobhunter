import { asc, eq } from "drizzle-orm";
import { answers, type Answer } from "@workspace/db";
import type { Db } from "../../lib/db";
import { ValidationError } from "../../lib/errors";
import { requiredStr, str } from "../../lib/validate";
import { STARTERS } from "./starters";

type Maybe<T> = T | null | undefined;

export type AnswerInputShape = {
  key?: Maybe<string>;
  question: string;
  answerType: string;
  answer?: Maybe<string>;
};

const MAX_ANSWERS = 50;
const TYPES = ["text", "yesno"];
const starterByKey = new Map<string, (typeof STARTERS)[number]>(STARTERS.map((s) => [s.key, s]));

function cleanAnswer(type: string, v: Maybe<string>): string | null {
  const s = str("answer", v, 2000);
  if (!s) return null;
  if (type === "yesno") {
    const lower = s.toLowerCase();
    if (lower === "yes") return "Yes";
    if (lower === "no") return "No";
    throw new ValidationError("A yes/no answer must be Yes or No");
  }
  return s;
}

async function ensureStarters(db: Db, profileId: string): Promise<void> {
  await db
    .insert(answers)
    .values(
      STARTERS.map((s, position) => ({
        profileId,
        key: s.key,
        question: s.question,
        answerType: s.answerType,
        position,
      })),
    )
    .onConflictDoNothing({ target: [answers.profileId, answers.key] });
}

export async function listAnswers(db: Db, profileId: string): Promise<Answer[]> {
  await ensureStarters(db, profileId);
  return db
    .select()
    .from(answers)
    .where(eq(answers.profileId, profileId))
    .orderBy(asc(answers.position), asc(answers.createdAt));
}

/** Replaces the whole bank. Starters can be cleared but not removed: any missing one comes back empty. */
export async function replaceAnswers(
  db: Db,
  profileId: string,
  items: AnswerInputShape[],
): Promise<Answer[]> {
  if (items.length > MAX_ANSWERS) {
    throw new ValidationError(`Too many answers (max ${MAX_ANSWERS})`);
  }

  const seen = new Set<string>();
  const rows = items.map((it, position) => {
    const key = it.key?.trim() || null;
    const starter = key ? starterByKey.get(key) : undefined;
    if (key) {
      if (!starter) throw new ValidationError("Unknown answer key");
      if (seen.has(key)) throw new ValidationError("The same question appears twice");
      seen.add(key);
    }
    const answerType = starter ? starter.answerType : it.answerType;
    if (!TYPES.includes(answerType)) throw new ValidationError("Unknown answer type");
    return {
      profileId,
      key,
      position,
      question: starter ? starter.question : requiredStr("question", it.question, 300),
      answerType: answerType as string,
      answer: cleanAnswer(answerType, it.answer),
    };
  });

  let position = rows.length;
  for (const s of STARTERS) {
    if (seen.has(s.key)) continue;
    rows.push({
      profileId,
      key: s.key,
      position: position++,
      question: s.question,
      answerType: s.answerType,
      answer: null,
    });
  }

  await db.transaction(async (tx) => {
    await tx.delete(answers).where(eq(answers.profileId, profileId));
    await tx.insert(answers).values(rows);
  });
  return listAnswers(db, profileId);
}
