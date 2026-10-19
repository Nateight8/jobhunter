import type { Board } from "@workspace/db";
import { builder } from "../../builder";
import { RemoteType } from "../jobs/jobs.types";
import { countJobsCapped } from "../jobs/jobs.service";
import { parseFilter, toJobFilter, type BoardFilter } from "./boards.filter";
import type { BoardPreset } from "./presets";

const BoardFilterRef = builder.objectRef<BoardFilter>("BoardFilter");
BoardFilterRef.implement({
  fields: (t) => ({
    search: t.exposeString("search", { nullable: true }),
    stack: t.exposeStringList("stack", { nullable: true }),
    remoteTypes: t.field({
      type: [RemoteType],
      nullable: true,
      resolve: (f) => f.remoteTypes ?? null,
    }),
    sources: t.exposeStringList("sources", { nullable: true }),
    startupOnly: t.exposeBoolean("startupOnly", { nullable: true }),
    startupMaxBoardSize: t.exposeInt("startupMaxBoardSize", { nullable: true }),
    titleIncludes: t.exposeStringList("titleIncludes", { nullable: true }),
    titleExcludes: t.exposeStringList("titleExcludes", { nullable: true }),
    regions: t.exposeStringList("regions", { nullable: true }),
  }),
});

export const BoardFilterInput = builder.inputType("BoardFilterInput", {
  fields: (t) => ({
    search: t.string(),
    stack: t.stringList(),
    remoteTypes: t.field({ type: [RemoteType] }),
    sources: t.stringList(),
    startupOnly: t.boolean(),
    startupMaxBoardSize: t.int(),
    titleIncludes: t.stringList(),
    titleExcludes: t.stringList(),
    regions: t.stringList(),
  }),
});

const BoardCountRef = builder.objectRef<{ value: number; capped: boolean }>("BoardCount");
BoardCountRef.implement({
  description: "Number of matching jobs, capped (value 500 + capped true means 500+).",
  fields: (t) => ({
    value: t.exposeInt("value"),
    capped: t.exposeBoolean("capped"),
  }),
});

export const BoardRef = builder.objectRef<Board>("Board");
BoardRef.implement({
  fields: (t) => ({
    id: t.exposeID("id"),
    name: t.exposeString("name"),
    position: t.exposeInt("position"),
    kind: t.exposeString("kind", { nullable: true, description: "recommended, or null for your own boards" }),
    filter: t.field({ type: BoardFilterRef, resolve: (b) => parseFilter(b.filter) }),
    count: t.field({
      type: BoardCountRef,
      description: "Computed on request, so ask for it in a separate query from the board list.",
      resolve: (b, _args, ctx) => countJobsCapped(ctx.db, b.profileId, toJobFilter(parseFilter(b.filter))),
    }),
  }),
});

export const BoardPresetRef = builder.objectRef<BoardPreset>("BoardPreset");
BoardPresetRef.implement({
  fields: (t) => ({
    id: t.exposeID("id"),
    name: t.exposeString("name"),
    description: t.exposeString("description"),
    filter: t.field({ type: BoardFilterRef, resolve: (p) => p.filter }),
  }),
});
