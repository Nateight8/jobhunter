import { builder } from "../../builder";
import { guard } from "../../graphql-errors";
import { getOrCreateProfile } from "../profile/profile.service";
import { clearJobAnswer, saveJobAnswer } from "./forms.service";
import { JobFormRef } from "./forms.types";

builder.mutationFields((t) => ({
  saveJobAnswer: t.field({
    type: JobFormRef,
    description:
      "Saves your answer to one question on one job (used before memory). With remember, it is also added to memory.",
    args: {
      jobId: t.arg.id({ required: true }),
      key: t.arg.string({ required: true }),
      answer: t.arg.string({ required: true }),
      remember: t.arg.boolean(),
    },
    resolve: (_root, { jobId, key, answer, remember }, ctx) =>
      guard(async () => {
        const profile = await getOrCreateProfile(ctx.db);
        return saveJobAnswer(ctx.db, profile, String(jobId), { key, answer, remember: !!remember });
      }),
  }),
  clearJobAnswer: t.field({
    type: JobFormRef,
    args: { jobId: t.arg.id({ required: true }), key: t.arg.string({ required: true }) },
    resolve: (_root, { jobId, key }, ctx) =>
      guard(async () => {
        const profile = await getOrCreateProfile(ctx.db);
        return clearJobAnswer(ctx.db, profile, String(jobId), key);
      }),
  }),
}));
