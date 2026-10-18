import { builder } from "../../builder";
import { guard } from "../../graphql-errors";
import { seedRecommendedBoard } from "../boards/boards.service";
import { confirmProfile, getOrCreateProfile } from "./profile.service";
import { ConfirmProfileInput, ProfileRef } from "./profile.types";

builder.mutationFields((t) => ({
  confirmProfile: t.field({
    type: ProfileRef,
    description:
      "Saves the reviewed profile in one transaction, computes years of experience from the experience dates and marks the draft confirmed. Requires name, email, phone, country and at least one authorized region. The first confirmation also creates the Recommended board.",
    args: {
      input: t.arg({ type: ConfirmProfileInput, required: true }),
      draftId: t.arg.id(),
    },
    resolve: (_root, { input, draftId }, ctx) =>
      guard(async () => {
        const before = await getOrCreateProfile(ctx.db);
        const profile = await confirmProfile(ctx.db, input, draftId ? String(draftId) : null);
        if (!before.confirmedAt) {
          try {
            await seedRecommendedBoard(ctx.db, profile);
          } catch (e) {
            console.error("could not seed the Recommended board:", e); // never fail a save over this
          }
        }
        return profile;
      }),
  }),
}));
