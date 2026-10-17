import { GraphQLError } from "graphql";
import { builder } from "../../builder";
import { InvalidCursorError } from "../../lib/pagination";
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
      try {
        return await listJobs(ctx.db, {
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
    resolve: (_root, args, ctx) => getJob(ctx.db, String(args.id)),
  }),
}));
