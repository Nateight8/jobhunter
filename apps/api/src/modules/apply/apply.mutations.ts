import { builder } from "../../builder";
import { guard } from "../../graphql-errors";
import { getOrCreateProfile } from "../profile/profile.service";
import { startApply } from "./apply.service";
import { ApplyRunRef } from "./apply.types";

builder.mutationFields((t) => ({
  startApply: t.field({
    type: ApplyRunRef,
    description:
      "Queues an auto-fill run for a job. The runner process (make runner) opens the form and fills it. Nothing is ever submitted for the user.",
    args: { jobId: t.arg.id({ required: true }) },
    resolve: (_root, { jobId }, ctx) =>
      guard(async () => {
        const profile = await getOrCreateProfile(ctx.db);
        return startApply(ctx.db, profile, String(jobId));
      }),
  }),
}));
