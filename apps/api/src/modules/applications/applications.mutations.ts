import { builder } from "../../builder";
import { guard } from "../../graphql-errors";
import { ValidationError } from "../../lib/errors";
import { getJob } from "../jobs/jobs.service";
import { JobRef } from "../jobs/jobs.types";
import { getOrCreateProfile } from "../profile/profile.service";
import { removeApplication, setApplicationNotes, setApplicationStatus } from "./applications.service";
import { ApplicationRef, ApplicationStatus } from "./applications.types";

builder.mutationFields((t) => ({
  setApplicationStatus: t.field({
    type: ApplicationRef,
    description:
      "Saves, hides or records progress on a job. Creates the record if needed. Moving to applied (or later) stamps the applied date once.",
    args: {
      jobId: t.arg.id({ required: true }),
      status: t.arg({ type: ApplicationStatus, required: true }),
      notes: t.arg.string(),
    },
    resolve: (_root, { jobId, status, notes }, ctx) =>
      guard(async () => {
        const profile = await getOrCreateProfile(ctx.db);
        return setApplicationStatus(ctx.db, profile.id, String(jobId), status, notes);
      }),
  }),
  setApplicationNotes: t.field({
    type: ApplicationRef,
    args: { jobId: t.arg.id({ required: true }), notes: t.arg.string() },
    resolve: (_root, { jobId, notes }, ctx) =>
      guard(async () => {
        const profile = await getOrCreateProfile(ctx.db);
        return setApplicationNotes(ctx.db, profile.id, String(jobId), notes ?? null);
      }),
  }),
  removeApplication: t.field({
    type: JobRef,
    description: "Forgets the profile's state for a job (unsave, restore, undo). Returns the job.",
    args: { jobId: t.arg.id({ required: true }) },
    resolve: (_root, { jobId }, ctx) =>
      guard(async () => {
        const profile = await getOrCreateProfile(ctx.db);
        await removeApplication(ctx.db, profile.id, String(jobId));
        const job = await getJob(ctx.db, String(jobId), profile.id);
        if (!job) throw new ValidationError("Job not found");
        return job;
      }),
  }),
}));
