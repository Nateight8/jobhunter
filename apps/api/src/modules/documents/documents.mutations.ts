import { builder } from "../../builder";
import { guard } from "../../graphql-errors";
import { ProfileRef } from "../profile/profile.types";
import { deleteDocument, setDefaultDocument } from "./documents.service";

// Uploading is a plain HTTP route (see documents.http.ts); these only manage metadata.
builder.mutationFields((t) => ({
  setDefaultDocument: t.field({
    type: ProfileRef,
    description: "Makes this document the default for its kind.",
    args: { id: t.arg.id({ required: true }) },
    resolve: (_root, { id }, ctx) => guard(() => setDefaultDocument(ctx.db, String(id))),
  }),
  deleteDocument: t.field({
    type: ProfileRef,
    description: "Deletes a document. If it was the default, the newest one of its kind takes over.",
    args: { id: t.arg.id({ required: true }) },
    resolve: (_root, { id }, ctx) => guard(() => deleteDocument(ctx.db, String(id))),
  }),
}));
