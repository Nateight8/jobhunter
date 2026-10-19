import { GraphQLError } from "graphql";
import { builder } from "../../builder";
import { InvalidCursorError } from "../../lib/pagination";
import { getOrCreateProfile } from "../profile/profile.service";
import { JobConnection, JobFilter, JobRef } from "./jobs.types";
import { getJob, listJobs } from "./jobs.service";

// Resolvers stay thin: validate, call the service, translate errors.
builder.queryFields((t) => ({
  jobs: t.field({
    type: JobConnection,
    args: {
      filter: t.arg({ type: JobFilter }),
      first: t.arg.int({ defaultValue: 25 }),
      after: t.arg.string(),
    },
    resolve: async (_root, args, ctx) => {
      const profile = await getOrCreateProfile(ctx.db);
      try {
        return await listJobs(ctx.db, profile.id, {
          filter: args.filter ?? {},
          first: args.first ?? 25,
          after: args.after,
        });
      } catch (e) {
        if (e instanceof InvalidCursorError) throw new GraphQLError(e.message);
        throw e;
      }
    },
  }),
  job: t.field({
    type: JobRef,
    nullable: true,
    args: { id: t.arg.id({ required: true }) },
    resolve: async (_root, args, ctx) => {
      const profile = await getOrCreateProfile(ctx.db);
      return getJob(ctx.db, String(args.id), profile.id);
    },
  }),
}));
