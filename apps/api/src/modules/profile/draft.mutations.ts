import { builder } from "../../builder";
import { guard } from "../../graphql-errors";
import { discardDraft, extractProfile } from "./extract.service";
import { getOrCreateProfile } from "./profile.service";
import { ProfileRef } from "./profile.types";

builder.mutationFields((t) => ({
  extractProfile: t.field({
    type: ProfileRef,
    description:
      "Reads a stored CV with Gemini and saves the result as a draft (see Profile.draft). Takes a few seconds. A failed extraction leaves a draft with status failed and an error message.",
    args: { documentId: t.arg.id({ required: true }) },
    resolve: (_root, { documentId }, ctx) =>
      guard(async () => {
        await extractProfile(ctx.db, String(documentId));
        return getOrCreateProfile(ctx.db);
      }),
  }),
  discardDraft: t.field({
    type: ProfileRef,
    args: { id: t.arg.id({ required: true }) },
    resolve: (_root, { id }, ctx) => guard(() => discardDraft(ctx.db, String(id))),
  }),
}));
