import { and, asc, eq } from "drizzle-orm";
import { boards, type Board, type NewBoard, type Profile } from "@workspace/db";
import type { Db } from "../../lib/db";
import { ValidationError } from "../../lib/errors";
import { isUuid } from "../../lib/pagination";
import { requiredStr } from "../../lib/validate";
import { listExperiences, listSkills } from "../profile/profile.service";
import { normalizeFilter, type BoardFilter, type BoardFilterInputShape } from "./boards.filter";

const MAX_BOARDS = 20; // counts run one query per board, so keep the tab bar bounded

export const listBoards = (db: Db, profileId: string): Promise<Board[]> =>
  db
    .select()
    .from(boards)
    .where(eq(boards.profileId, profileId))
    .orderBy(asc(boards.position), asc(boards.createdAt));

export async function createBoard(
  db: Db,
  profileId: string,
  input: { name: string; filter?: BoardFilterInputShape | null; kind?: string | null },
): Promise<Board> {
  const name = requiredStr("name", input.name, 60);
  const existing = await listBoards(db, profileId);
  if (existing.length >= MAX_BOARDS) {
    throw new ValidationError(`Too many boards (max ${MAX_BOARDS}). Delete one first.`);
  }
  const position = existing.length ? Math.max(...existing.map((b) => b.position)) + 1 : 0;
  const [row] = await db
    .insert(boards)
    .values({ profileId, name, position, kind: input.kind ?? null, filter: normalizeFilter(input.filter) })
    .returning();
  return row!;
}

export async function updateBoard(
  db: Db,
  profileId: string,
  id: string,
  patch: { name?: string | null; filter?: BoardFilterInputShape | null },
): Promise<Board> {
  if (!isUuid(id)) throw new ValidationError("Board not found");
  const set: Partial<NewBoard> = {};
  if (patch.name != null) set.name = requiredStr("name", patch.name, 60);
  if (patch.filter != null) set.filter = normalizeFilter(patch.filter);

  if (Object.keys(set).length === 0) {
    const [row] = await db
      .select()
      .from(boards)
      .where(and(eq(boards.id, id), eq(boards.profileId, profileId)));
    if (!row) throw new ValidationError("Board not found");
    return row;
  }
  const [row] = await db
    .update(boards)
    .set(set)
    .where(and(eq(boards.id, id), eq(boards.profileId, profileId)))
    .returning();
  if (!row) throw new ValidationError("Board not found");
  return row;
}

export async function deleteBoard(db: Db, profileId: string, id: string): Promise<Board[]> {
  if (!isUuid(id)) throw new ValidationError("Board not found");
  await db.transaction(async (tx) => {
    const res = await tx
      .delete(boards)
      .where(and(eq(boards.id, id), eq(boards.profileId, profileId)))
      .returning({ id: boards.id });
    if (res.length === 0) throw new ValidationError("Board not found");
    const rest = await tx
      .select({ id: boards.id })
      .from(boards)
      .where(eq(boards.profileId, profileId))
      .orderBy(asc(boards.position), asc(boards.createdAt));
    for (let i = 0; i < rest.length; i++) {
      await tx.update(boards).set({ position: i }).where(eq(boards.id, rest[i]!.id));
    }
  });
  return listBoards(db, profileId);
}

export async function reorderBoards(db: Db, profileId: string, ids: string[]): Promise<Board[]> {
  const current = await listBoards(db, profileId);
  const same =
    ids.length === current.length &&
    new Set(ids).size === ids.length &&
    current.every((b) => ids.includes(b.id));
  if (!same) throw new ValidationError("The board list changed. Reload and try again.");
  await db.transaction(async (tx) => {
    for (let i = 0; i < ids.length; i++) {
      await tx
        .update(boards)
        .set({ position: i })
        .where(and(eq(boards.id, ids[i]!), eq(boards.profileId, profileId)));
    }
  });
  return listBoards(db, profileId);
}

/** Top technologies from experience (recent roles weigh more), capped at 8. Falls back to skills. */
export async function recommendedFilter(db: Db, profileId: string): Promise<BoardFilter | null> {
  const exps = await listExperiences(db, profileId);
  const scores = new Map<string, { name: string; score: number; first: number }>();
  let order = 0;
  exps.forEach((e, i) => {
    const weight = 1 / (1 + i);
    for (const t of e.technologies) {
      const name = t.trim();
      if (!name) continue;
      const key = name.toLowerCase();
      const cur = scores.get(key) ?? { name, score: 0, first: order++ };
      cur.score += weight;
      scores.set(key, cur);
    }
  });
  let stack = [...scores.values()]
    .sort((a, b) => b.score - a.score || a.first - b.first)
    .slice(0, 8)
    .map((s) => s.name);
  if (stack.length === 0) {
    stack = (await listSkills(db, profileId)).slice(0, 8).map((s) => s.name);
  }
  return stack.length ? { stack } : null;
}

/** Creates the Recommended board once, the first time a profile is confirmed. */
export async function seedRecommendedBoard(db: Db, profile: Profile): Promise<Board | null> {
  const filter = await recommendedFilter(db, profile.id);
  if (!filter) return null;
  const existing = await listBoards(db, profile.id);
  if (existing.some((b) => b.kind === "recommended")) return null;
  return createBoard(db, profile.id, { name: "Recommended", filter, kind: "recommended" });
}

/** Regenerates the Recommended board from the profile, or creates it if it's missing. */
export async function resetRecommendedBoard(db: Db, profile: Profile): Promise<Board> {
  const filter = await recommendedFilter(db, profile.id);
  if (!filter) {
    throw new ValidationError(
      "Add technologies to your experience, or skills, to your profile to get recommendations.",
    );
  }
  const existing = (await listBoards(db, profile.id)).find((b) => b.kind === "recommended");
  if (existing) return updateBoard(db, profile.id, existing.id, { filter });
  return createBoard(db, profile.id, { name: "Recommended", filter, kind: "recommended" });
}
