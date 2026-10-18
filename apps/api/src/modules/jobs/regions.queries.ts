import { builder } from "../../builder";
import { regionName } from "../../lib/regions";
import { listRegionOptions } from "./jobs.service";

const RegionOptionRef = builder.objectRef<{ code: string; count: number }>("RegionOption");
RegionOptionRef.implement({
  description: "A region at least one open job is placed in. Options come from the data.",
  fields: (t) => ({
    code: t.exposeString("code"),
    name: t.string({ resolve: (r) => regionName(r.code) }),
    count: t.exposeInt("count"),
  }),
});

builder.queryFields((t) => ({
  regionOptions: t.field({
    type: [RegionOptionRef],
    resolve: (_root, _args, ctx) => listRegionOptions(ctx.db),
  }),
}));
