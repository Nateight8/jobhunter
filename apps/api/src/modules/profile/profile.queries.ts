import { builder } from "../../builder";
import { getOrCreateProfile } from "./profile.service";
import { ProfileRef } from "./profile.types";

builder.queryFields((t) => ({
  profile: t.field({
    type: ProfileRef,
    description: "The single local profile. Created empty on first read.",
    resolve: (_root, _args, ctx) => getOrCreateProfile(ctx.db),
  }),
}));
