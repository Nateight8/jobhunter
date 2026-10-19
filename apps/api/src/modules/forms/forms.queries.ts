import { builder } from "../../builder";
import { guard } from "../../graphql-errors";
import { getOrCreateProfile } from "../profile/profile.service";
import { getJobForm } from "./forms.service";
import { JobFormRef } from "./forms.types";

builder.queryFields((t) => ({
  jobForm: t.field({
    type: JobFormRef,
    description: "The application form for a job. Makes a network call on first use, then caches for 12 hours.",
    args: { jobId: t.arg.id({ required: true }), refresh: t.arg.boolean() },
    resolve: (_root, { jobId, refresh }, ctx) =>
      guard(async () => {
        const profile = await getOrCreateProfile(ctx.db);
        return getJobForm(ctx.db, profile, String(jobId), !!refresh);
      }),
  }),
}));
