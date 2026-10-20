import { builder } from "../../builder";
import { getOrCreateProfile } from "../profile/profile.service";
import { latestRun } from "./apply.service";
import { ApplyRunRef } from "./apply.types";

builder.queryFields((t) => ({
  applyRun: t.field({
    type: ApplyRunRef,
    nullable: true,
    description: "The most recent auto-fill run for a job, if any.",
    args: { jobId: t.arg.id({ required: true }) },
    resolve: async (_root, { jobId }, ctx) => {
      const profile = await getOrCreateProfile(ctx.db);
      return latestRun(ctx.db, profile.id, String(jobId));
    },
  }),
}));
