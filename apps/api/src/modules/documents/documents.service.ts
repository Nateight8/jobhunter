import { and, count, desc, eq } from "drizzle-orm";
import { documentFiles, documents, type Document, type Profile } from "@workspace/db";
import type { Db } from "../../lib/db";
import { ValidationError } from "../../lib/errors";
import { isUuid } from "../../lib/pagination";
import { getOrCreateProfile } from "../profile/profile.service";

export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
const MAX_DOCUMENTS = 50;

export const DOCUMENT_KINDS = ["cv", "cover_letter", "other"] as const;

const PDF = "application/pdf";
const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

// Decide the type from the file's own bytes; never trust the filename or the client.
export function detectType(buf: Buffer): { mime: string; ext: string } | null {
  if (buf.subarray(0, 5).toString("latin1") === "%PDF-") return { mime: PDF, ext: ".pdf" };
  const isZip =
    buf.length > 4 && buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04;
  if (isZip && buf.includes("word/document.xml")) return { mime: DOCX, ext: ".docx" };
  return null;
}

function cleanFilename(raw: string, ext: string): string {
  let name = (raw.split(/[\\/]/).pop() ?? "").replace(/\p{C}/gu, "").trim().slice(0, 150);
  if (!name) name = "document";
  return name.toLowerCase().endsWith(ext) ? name : `${name}${ext}`;
}

export async function saveDocument(
  db: Db,
  input: { kind: string; filename: string; content: Buffer },
): Promise<Document> {
  if (!(DOCUMENT_KINDS as readonly string[]).includes(input.kind)) {
    throw new ValidationError("kind must be cv, cover_letter or other");
  }
  if (input.content.length === 0) throw new ValidationError("The file is empty");
  if (input.content.length > MAX_DOCUMENT_BYTES) {
    throw new ValidationError("The file is larger than 10 MB");
  }
  const type = detectType(input.content);
  if (!type) throw new ValidationError("Only PDF and DOCX files are supported");

  const profile = await getOrCreateProfile(db);
  const [{ n }] = await db
    .select({ n: count() })
    .from(documents)
    .where(eq(documents.profileId, profile.id));
  if (n >= MAX_DOCUMENTS) {
    throw new ValidationError(`Too many documents (max ${MAX_DOCUMENTS}). Delete some first.`);
  }

  return db.transaction(async (tx) => {
    // the newest upload of a kind becomes its default
    await tx
      .update(documents)
      .set({ isDefault: false })
      .where(
        and(
          eq(documents.profileId, profile.id),
          eq(documents.kind, input.kind),
          eq(documents.isDefault, true),
        ),
      );
    const [doc] = await tx
      .insert(documents)
      .values({
        profileId: profile.id,
        kind: input.kind,
        filename: cleanFilename(input.filename, type.ext),
        mimeType: type.mime,
        sizeBytes: input.content.length,
        isDefault: true,
      })
      .returning();
    await tx.insert(documentFiles).values({ documentId: doc!.id, content: input.content });
    return doc!;
  });
}

export async function getDocumentFile(db: Db, id: string) {
  if (!isUuid(id)) return null;
  const [row] = await db
    .select({
      filename: documents.filename,
      mimeType: documents.mimeType,
      content: documentFiles.content,
    })
    .from(documents)
    .innerJoin(documentFiles, eq(documentFiles.documentId, documents.id))
    .where(eq(documents.id, id))
    .limit(1);
  return row ?? null;
}

export const listDocuments = (db: Db, profileId: string) =>
  db
    .select()
    .from(documents)
    .where(eq(documents.profileId, profileId))
    .orderBy(desc(documents.createdAt));

export async function setDefaultDocument(db: Db, id: string): Promise<Profile> {
  const profile = await getOrCreateProfile(db);
  if (!isUuid(id)) throw new ValidationError("Document not found");
  await db.transaction(async (tx) => {
    const [doc] = await tx
      .select()
      .from(documents)
      .where(and(eq(documents.id, id), eq(documents.profileId, profile.id)));
    if (!doc) throw new ValidationError("Document not found");
    await tx
      .update(documents)
      .set({ isDefault: false })
      .where(
        and(
          eq(documents.profileId, profile.id),
          eq(documents.kind, doc.kind),
          eq(documents.isDefault, true),
        ),
      );
    await tx.update(documents).set({ isDefault: true }).where(eq(documents.id, id));
  });
  return profile;
}

export async function deleteDocument(db: Db, id: string): Promise<Profile> {
  const profile = await getOrCreateProfile(db);
  if (!isUuid(id)) throw new ValidationError("Document not found");
  await db.transaction(async (tx) => {
    const [doc] = await tx
      .select()
      .from(documents)
      .where(and(eq(documents.id, id), eq(documents.profileId, profile.id)));
    if (!doc) throw new ValidationError("Document not found");
    await tx.delete(documents).where(eq(documents.id, id)); // the file row cascades
    if (doc.isDefault) {
      // promote the newest remaining document of the same kind
      const [next] = await tx
        .select({ id: documents.id })
        .from(documents)
        .where(and(eq(documents.profileId, profile.id), eq(documents.kind, doc.kind)))
        .orderBy(desc(documents.createdAt))
        .limit(1);
      if (next) await tx.update(documents).set({ isDefault: true }).where(eq(documents.id, next.id));
    }
  });
  return profile;
}
