import { builder } from "../../builder";
import { guard } from "../../graphql-errors";
import { getOrCreateProfile } from "../profile/profile.service";
import { deleteMemoryEntry, saveMemoryEntry } from "./memory.service";
import { AnswerType, MemoryEntryRef } from "./memory.types";

builder.mutationFields((t) => ({
  saveMemoryEntry: t.field({
    type: MemoryEntryRef,
    description: "Adds an entry, or edits the one with this id. The same question again updates the existing entry.",
    args: {
      id: t.arg.id(),
      question: t.arg.string({ required: true }),
      answerType: t.arg({ type: AnswerType, required: true }),
      answer: t.arg.string({ required: true }),
    },
    resolve: (_root, { id, question, answerType, answer }, ctx) =>
      guard(async () => {
        const profile = await getOrCreateProfile(ctx.db);
        return saveMemoryEntry(ctx.db, profile.id, {
          id: id ? String(id) : null,
          question,
          answerType,
          answer,
        });
      }),
  }),
  deleteMemoryEntry: t.field({
    type: [MemoryEntryRef],
    description: "Returns the remaining entries.",
    args: { id: t.arg.id({ required: true }) },
    resolve: (_root, { id }, ctx) =>
      guard(async () => {
        const profile = await getOrCreateProfile(ctx.db);
        return deleteMemoryEntry(ctx.db, profile.id, String(id));
      }),
  }),
}));
