import type { Document } from "@workspace/db";
import { builder } from "../../builder";
import { ProfileRef } from "../profile/profile.types";
import { listDocuments } from "./documents.service";

const publicBase = process.env.API_PUBLIC_URL ?? `http://localhost:${process.env.API_PORT ?? 4000}`;

const DocumentKind = builder.enumType("DocumentKind", {
  values: {
    CV: { value: "cv" },
    COVER_LETTER: { value: "cover_letter" },
    OTHER: { value: "other" },
  } as const,
});

export const DocumentRef = builder.objectRef<Document>("Document");
DocumentRef.implement({
  description: "File metadata. Bytes are served from the downloadUrl, never through GraphQL.",
  fields: (t) => ({
    id: t.exposeID("id"),
    kind: t.field({
      type: DocumentKind,
      resolve: (d) => d.kind as "cv" | "cover_letter" | "other",
    }),
    filename: t.exposeString("filename"),
    mimeType: t.exposeString("mimeType"),
    sizeBytes: t.exposeInt("sizeBytes"),
    isDefault: t.exposeBoolean("isDefault"),
    createdAt: t.string({ resolve: (d) => d.createdAt.toISOString() }),
    downloadUrl: t.string({ resolve: (d) => `${publicBase}/documents/${d.id}` }),
  }),
});

builder.objectField(ProfileRef, "documents", (t) =>
  t.field({
    type: [DocumentRef],
    resolve: (p, _args, ctx) => listDocuments(ctx.db, p.id),
  }),
);
