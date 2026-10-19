import { builder } from "../../builder";
import { JobRef } from "../jobs/jobs.types";
import { getOrCreateProfile } from "../profile/profile.service";
import { getApplication, type ApplicationRow, type ApplicationStatusValue } from "./applications.service";

export const ApplicationStatus = builder.enumType("ApplicationStatus", {
  values: {
    SAVED: { value: "saved" },
    APPLIED: { value: "applied" },
    INTERVIEWING: { value: "interviewing" },
    OFFER: { value: "offer" },
    REJECTED: { value: "rejected" },
    HIDDEN: { value: "hidden" },
  } as const,
});

export const ApplicationRef = builder.objectRef<ApplicationRow>("Application");
ApplicationRef.implement({
  description: "The profile's own state for one job. Personal data: it never touches the public jobs table.",
  fields: (t) => ({
    id: t.exposeID("id"),
    status: t.field({ type: ApplicationStatus, resolve: (a) => a.status as ApplicationStatusValue }),
    appliedAt: t.string({ nullable: true, resolve: (a) => a.appliedAt?.toISOString() ?? null }),
    notes: t.exposeString("notes", { nullable: true }),
    updatedAt: t.string({ resolve: (a) => a.updatedAt.toISOString() }),
    job: t.field({ type: JobRef, resolve: (a) => a.job }),
  }),
});

const CountRef = builder.objectRef<{ status: string; count: number }>("ApplicationCount");
CountRef.implement({
  fields: (t) => ({
    status: t.field({ type: ApplicationStatus, resolve: (c) => c.status as ApplicationStatusValue }),
    count: t.exposeInt("count"),
  }),
});
export { CountRef as ApplicationCountRef };

// Added to Job here, not in the jobs module, so the two modules don't import each other.
builder.objectField(JobRef, "applicationStatus", (t) =>
  t.field({
    type: ApplicationStatus,
    nullable: true,
    resolve: (j) => (j.applicationStatus as ApplicationStatusValue | null) ?? null,
  }),
);

builder.objectField(JobRef, "application", (t) =>
  t.field({
    type: ApplicationRef,
    nullable: true,
    description: "Full application record. One query per job, so request it on a single job, not in lists.",
    resolve: async (j, _args, ctx) => {
      const profile = await getOrCreateProfile(ctx.db);
      return getApplication(ctx.db, profile.id, j.id);
    },
  }),
);
