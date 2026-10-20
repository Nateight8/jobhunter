import type { ApplyRun } from "@workspace/db";
import { builder } from "../../builder";
import { hasScreenshot, type Outcome, type Report } from "./apply.service";

const publicBase = process.env.API_PUBLIC_URL ?? `http://localhost:${process.env.API_PORT ?? 4000}`;

const ApplyRunStatus = builder.enumType("ApplyRunStatus", {
  values: {
    QUEUED: { value: "queued" },
    OPENING: { value: "opening" },
    FILLING: { value: "filling" },
    NEEDS_YOU: { value: "needs_you", description: "Filled. Waiting for the user to review and press Submit." },
    SUBMITTED: { value: "submitted" },
    CLOSED: { value: "closed" },
    FAILED: { value: "failed" },
    ABANDONED: { value: "abandoned" },
  } as const,
});

const OutcomeState = builder.enumType("OutcomeState", {
  values: {
    FILLED: { value: "filled" },
    CHECK: { value: "check", description: "Filled, but worth a look" },
    LEFT: { value: "left", description: "Left blank for the user" },
    FAILED: { value: "failed" },
  } as const,
});

const OutcomeRef = builder.objectRef<Outcome>("RunOutcome");
OutcomeRef.implement({
  fields: (t) => ({
    key: t.exposeString("key"),
    label: t.exposeString("label"),
    required: t.exposeBoolean("required"),
    state: t.field({ type: OutcomeState, resolve: (o) => o.state }),
    note: t.exposeString("note", { nullable: true }),
  }),
});

const LogLineRef = builder.objectRef<{ at: string; text: string }>("RunLogLine");
LogLineRef.implement({
  fields: (t) => ({ at: t.exposeString("at"), text: t.exposeString("text") }),
});

export const ApplyRunRef = builder.objectRef<ApplyRun>("ApplyRun");
ApplyRunRef.implement({
  description: "One auto-fill attempt. The runner fills the form in a visible browser; the user submits.",
  fields: (t) => ({
    id: t.exposeID("id"),
    jobId: t.exposeID("jobId"),
    status: t.field({ type: ApplyRunStatus, resolve: (r) => r.status as never }),
    message: t.exposeString("message", { nullable: true }),
    createdAt: t.string({ resolve: (r) => r.createdAt.toISOString() }),
    updatedAt: t.string({ resolve: (r) => r.updatedAt.toISOString() }),
    outcomes: t.field({
      type: [OutcomeRef],
      resolve: (r) => (r.report as Report | null)?.outcomes ?? [],
    }),
    log: t.field({
      type: [LogLineRef],
      resolve: (r) => (Array.isArray(r.log) ? (r.log as { at: string; text: string }[]).slice(-30) : []),
    }),
    screenshotUrl: t.string({
      nullable: true,
      description: "Screenshot of the confirmation page, captured after the user submitted.",
      resolve: async (r, _args, ctx) =>
        (await hasScreenshot(ctx.db, r.id)) ? `${publicBase}/apply-runs/${r.id}/screenshot` : null,
    }),
  }),
});
