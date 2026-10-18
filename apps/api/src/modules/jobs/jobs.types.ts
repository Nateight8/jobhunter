import { builder } from "../../builder";
import { getJobDescription, type JobRow } from "./jobs.service";

type RemoteTypeValue = "remote" | "hybrid" | "onsite" | "unknown";

export const RemoteType = builder.enumType("RemoteType", {
  values: {
    REMOTE: { value: "remote" },
    HYBRID: { value: "hybrid" },
    ONSITE: { value: "onsite" },
    UNKNOWN: { value: "unknown" },
  } as const,
});

export const JobFilter = builder.inputType("JobFilter", {
  fields: (t) => ({
    search: t.string({ description: "Matches job title or company name" }),
    stack: t.stringList({ description: 'Keywords, any match, e.g. ["node", "react"]' }),
    remoteTypes: t.field({ type: [RemoteType] }),
    sources: t.stringList(),
    startupOnly: t.boolean({ description: "Only jobs from ATS boards under the size limit" }),
    startupMaxBoardSize: t.int({ description: "Default 50 open jobs" }),
    includeClosed: t.boolean(),
    titleIncludes: t.stringList({ description: "Title must contain any of these words" }),
    titleExcludes: t.stringList({ description: "Title must contain none of these words" }),
    regions: t.stringList({ description: "Region codes (see regionOptions). Any match; jobs with no region are left out." }),
  }),
});

const iso = (d: Date | null) => (d ? d.toISOString() : null);

export const JobRef = builder.objectRef<JobRow>("Job");
JobRef.implement({
  fields: (t) => ({
    id: t.exposeID("id"),
    source: t.exposeString("source"),
    url: t.exposeString("url"),
    applyUrl: t.exposeString("applyUrl", { nullable: true }),
    title: t.exposeString("title"),
    companyName: t.exposeString("companyName"),
    location: t.exposeString("location", { nullable: true }),
    remoteType: t.field({ type: RemoteType, resolve: (j) => j.remoteType as RemoteTypeValue }),
    status: t.exposeString("status"),
    score: t.exposeInt("score", { nullable: true }),
    boardSize: t.exposeInt("boardSize", { nullable: true }),
    postedAt: t.string({ nullable: true, resolve: (j) => iso(j.postedAt) }),
    firstSeenAt: t.string({ resolve: (j) => j.firstSeenAt.toISOString() }),
    closedAt: t.string({ nullable: true, resolve: (j) => iso(j.closedAt) }),
    description: t.string({
      nullable: true,
      description: "Raw HTML. Loaded on demand, so avoid requesting it in lists.",
      resolve: (j, _args, ctx) =>
        j.description !== undefined ? j.description : getJobDescription(ctx.db, j.id),
    }),
  }),
});

type Edge = { cursor: string; node: JobRow };
const JobEdge = builder.objectRef<Edge>("JobEdge").implement({
  fields: (t) => ({
    cursor: t.exposeString("cursor"),
    node: t.field({ type: JobRef, resolve: (e) => e.node }),
  }),
});

type PageInfoShape = { hasNextPage: boolean; endCursor: string | null };
const PageInfo = builder.objectRef<PageInfoShape>("PageInfo").implement({
  fields: (t) => ({
    hasNextPage: t.exposeBoolean("hasNextPage"),
    endCursor: t.exposeString("endCursor", { nullable: true }),
  }),
});

export const JobConnection = builder
  .objectRef<{ edges: Edge[]; pageInfo: PageInfoShape; totalCount: number }>("JobConnection")
  .implement({
    fields: (t) => ({
      totalCount: t.exposeInt("totalCount"),
      edges: t.field({ type: [JobEdge], resolve: (c) => c.edges }),
      pageInfo: t.field({ type: PageInfo, resolve: (c) => c.pageInfo }),
    }),
  });
