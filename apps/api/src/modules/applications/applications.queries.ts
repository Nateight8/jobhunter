import { builder } from "../../builder";
import { getOrCreateProfile } from "../profile/profile.service";
import { applicationCounts, listApplications } from "./applications.service";
import { ApplicationCountRef, ApplicationRef, ApplicationStatus } from "./applications.types";

builder.queryFields((t) => ({
  applications: t.field({
    type: [ApplicationRef],
    description: "Newest activity first. Omit status for all.",
    args: { status: t.arg({ type: ApplicationStatus }) },
    resolve: async (_root, { status }, ctx) => {
      const profile = await getOrCreateProfile(ctx.db);
      return listApplications(ctx.db, profile.id, status ?? undefined);
    },
  }),
  applicationCounts: t.field({
    type: [ApplicationCountRef],
    resolve: async (_root, _args, ctx) => {
      const profile = await getOrCreateProfile(ctx.db);
      return applicationCounts(ctx.db, profile.id);
    },
  }),
}));
