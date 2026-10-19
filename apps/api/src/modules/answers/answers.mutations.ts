import { builder } from "../../builder";
import { guard } from "../../graphql-errors";
import { getOrCreateProfile } from "../profile/profile.service";
import { replaceAnswers } from "./answers.service";
import { AnswerInput, AnswerRef } from "./answers.types";

builder.mutationFields((t) => ({
  saveAnswers: t.field({
    type: [AnswerRef],
    description: "Replaces the whole bank in one transaction. Starters you leave out come back empty.",
    args: { items: t.arg({ type: [AnswerInput], required: true }) },
    resolve: (_root, { items }, ctx) =>
      guard(async () => {
        const profile = await getOrCreateProfile(ctx.db);
        return replaceAnswers(ctx.db, profile.id, items);
      }),
  }),
}));
