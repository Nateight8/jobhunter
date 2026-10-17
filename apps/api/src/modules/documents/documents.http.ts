import type { IncomingMessage, ServerResponse } from "node:http";
import type { Db } from "../../lib/db";
import { ValidationError } from "../../lib/errors";
import { isUuid } from "../../lib/pagination";
import { MAX_DOCUMENT_BYTES, getDocumentFile, saveDocument } from "./documents.service";

const BODY_LIMIT = MAX_DOCUMENT_BYTES + 256 * 1024; // room for multipart framing

function json(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

async function readBody(req: IncomingMessage, limit: number): Promise<Buffer | null> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > limit) return null;
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks);
}

/** Plain HTTP routes for file bytes. Returns true when it handled the request. */
export function createDocumentsHandler(db: Db, webOrigin: string) {
  async function upload(req: IncomingMessage, res: ServerResponse) {
    // A multipart POST needs no CORS preflight, so refuse other sites explicitly.
    const origin = req.headers.origin;
    if (origin && origin !== webOrigin) return json(res, 403, { error: "Origin not allowed" });

    const contentType = req.headers["content-type"] ?? "";
    if (!contentType.startsWith("multipart/form-data")) {
      return json(res, 415, { error: "Send multipart/form-data with a file field" });
    }
    const tooLarge = { error: "The file is larger than 10 MB" };
    if (Number(req.headers["content-length"] ?? 0) > BODY_LIMIT) {
      res.setHeader("connection", "close");
      return json(res, 413, tooLarge);
    }
    const body = await readBody(req, BODY_LIMIT);
    if (!body) {
      res.setHeader("connection", "close");
      return json(res, 413, tooLarge);
    }

    const form = await new Request("http://localhost/", {
      method: "POST",
      headers: { "content-type": contentType },
      body: new Uint8Array(body),
    }).formData();

    const file = form.get("file");
    if (!file || typeof file === "string") {
      return json(res, 400, { error: "Missing file field" });
    }
    const kindField = form.get("kind");
    const doc = await saveDocument(db, {
      kind: typeof kindField === "string" ? kindField : "cv",
      filename: file.name,
      content: Buffer.from(await file.arrayBuffer()),
    });
    json(res, 201, {
      id: doc.id,
      kind: doc.kind,
      filename: doc.filename,
      mimeType: doc.mimeType,
      sizeBytes: doc.sizeBytes,
      isDefault: doc.isDefault,
    });
  }

  async function download(id: string, res: ServerResponse) {
    const file = isUuid(id) ? await getDocumentFile(db, id) : null;
    if (!file) return json(res, 404, { error: "Not found" });

    const inline = file.mimeType === "application/pdf";
    const ascii = file.filename.replace(/[^\w. -]/g, "_");
    res.writeHead(200, {
      "content-type": file.mimeType,
      "content-length": file.content.length,
      "content-disposition": `${inline ? "inline" : "attachment"}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(file.filename)}`,
      "x-content-type-options": "nosniff",
      "cache-control": "private, no-store",
    });
    res.end(file.content);
  }

  return async function handle(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
    const { pathname } = new URL(req.url ?? "/", "http://localhost");
    const match = /^\/documents(?:\/([^/]+))?$/.exec(pathname);
    if (!match) return false;
    const id = match[1];

    res.setHeader("access-control-allow-origin", webOrigin);
    res.setHeader("vary", "Origin");
    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "access-control-allow-methods": "GET, POST, OPTIONS",
        "access-control-allow-headers": "content-type",
        "access-control-max-age": "600",
      });
      res.end();
      return true;
    }

    try {
      if (req.method === "POST" && !id) await upload(req, res);
      else if (req.method === "GET" && id) await download(id, res);
      else json(res, 405, { error: "Method not allowed" });
    } catch (e) {
      if (e instanceof ValidationError) {
        json(res, 400, { error: e.message });
      } else {
        console.error(e);
        if (!res.headersSent) json(res, 500, { error: "Internal error" });
      }
    }
    return true;
  };
}
