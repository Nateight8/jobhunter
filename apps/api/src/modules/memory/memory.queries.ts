import { builder } from "../../builder";
import { getOrCreateProfile } from "../profile/profile.service";
import { listMemory } from "./memory.service";
import { MemoryEntryRef } from "./memory.types";

builder.queryFields((t) => ({
  memory: t.field({
    type: [MemoryEntryRef],
    description: "Remembered answers, most recently changed first.",
    resolve: async (_root, _args, ctx) => {
      const profile = await getOrCreateProfile(ctx.db);
      return listMemory(ctx.db, profile.id);
    },
  }),
}));
