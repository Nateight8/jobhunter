import { builder } from "../../builder";
import { getOrCreateProfile } from "../profile/profile.service";
import { listBoards } from "./boards.service";
import { BoardPresetRef, BoardRef } from "./boards.types";
import { presets } from "./presets";

builder.queryFields((t) => ({
  boards: t.field({
    type: [BoardRef],
    description: "The profile's boards in tab order. All is not a board: it is the feed with no board.",
    resolve: async (_root, _args, ctx) => {
      const profile = await getOrCreateProfile(ctx.db);
      return listBoards(ctx.db, profile.id);
    },
  }),
  boardPresets: t.field({
    type: [BoardPresetRef],
    resolve: () => presets,
  }),
}));
