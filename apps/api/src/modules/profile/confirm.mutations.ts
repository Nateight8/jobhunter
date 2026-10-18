import { builder } from "../../builder";
import { guard } from "../../graphql-errors";
import { confirmProfile } from "./profile.service";
import { ConfirmProfileInput, ProfileRef } from "./profile.types";

builder.mutationFields((t) => ({
  confirmProfile: t.field({
    type: ProfileRef,
    description:
      "Saves the reviewed profile in one transaction, computes years of experience from the experience dates and marks the draft confirmed. Requires name, email, phone, country and at least one authorized region.",
    args: {
      input: t.arg({ type: ConfirmProfileInput, required: true }),
      draftId: t.arg.id(),
    },
    resolve: (_root, { input, draftId }, ctx) =>
      guard(() => confirmProfile(ctx.db, input, draftId ? String(draftId) : null)),
  }),
}));
