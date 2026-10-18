import { builder } from "../../builder";
import { guard } from "../../graphql-errors";
import { getOrCreateProfile } from "../profile/profile.service";
import { createBoard, deleteBoard, reorderBoards, resetRecommendedBoard, updateBoard } from "./boards.service";
import { BoardFilterInput, BoardRef } from "./boards.types";

builder.mutationFields((t) => ({
  createBoard: t.field({
    type: BoardRef,
    args: { name: t.arg.string({ required: true }), filter: t.arg({ type: BoardFilterInput }) },
    resolve: (_root, { name, filter }, ctx) =>
      guard(async () => {
        const profile = await getOrCreateProfile(ctx.db);
        return createBoard(ctx.db, profile.id, { name, filter });
      }),
  }),
  updateBoard: t.field({
    type: BoardRef,
    description: "Renames and/or replaces the filter. Omitted arguments stay as they are.",
    args: {
      id: t.arg.id({ required: true }),
      name: t.arg.string(),
      filter: t.arg({ type: BoardFilterInput }),
    },
    resolve: (_root, { id, name, filter }, ctx) =>
      guard(async () => {
        const profile = await getOrCreateProfile(ctx.db);
        return updateBoard(ctx.db, profile.id, String(id), { name, filter });
      }),
  }),
  deleteBoard: t.field({
    type: [BoardRef],
    description: "Returns the remaining boards.",
    args: { id: t.arg.id({ required: true }) },
    resolve: (_root, { id }, ctx) =>
      guard(async () => {
        const profile = await getOrCreateProfile(ctx.db);
        return deleteBoard(ctx.db, profile.id, String(id));
      }),
  }),
  reorderBoards: t.field({
    type: [BoardRef],
    description: "Takes every board id in the new order.",
    args: { ids: t.arg.idList({ required: true }) },
    resolve: (_root, { ids }, ctx) =>
      guard(async () => {
        const profile = await getOrCreateProfile(ctx.db);
        return reorderBoards(ctx.db, profile.id, ids.map(String));
      }),
  }),
  resetRecommendedBoard: t.field({
    type: BoardRef,
    description: "Regenerates the Recommended board from the CV, or creates it if it is missing.",
    resolve: (_root, _args, ctx) =>
      guard(async () => {
        const profile = await getOrCreateProfile(ctx.db);
        return resetRecommendedBoard(ctx.db, profile);
      }),
  }),
}));
