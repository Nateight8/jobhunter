import { builder } from "../../builder";
import { getOrCreateProfile } from "../profile/profile.service";
import { listAnswers } from "./answers.service";
import { AnswerRef } from "./answers.types";

builder.queryFields((t) => ({
  answers: t.field({
    type: [AnswerRef],
    description: "The answers bank. Starter questions are created on first read.",
    resolve: async (_root, _args, ctx) => {
      const profile = await getOrCreateProfile(ctx.db);
      return listAnswers(ctx.db, profile.id);
    },
  }),
}));
