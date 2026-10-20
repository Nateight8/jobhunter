import type { IncomingMessage, ServerResponse } from "node:http";
import type { Db } from "../../lib/db";
import { isUuid } from "../../lib/pagination";
import { getScreenshot } from "./apply.service";

/** Serves the confirmation screenshot. Returns true when it handled the request. */
export function createApplyHandler(db: Db) {
  return async function handle(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
    const { pathname } = new URL(req.url ?? "/", "http://localhost");
    const match = /^\/apply-runs\/([^/]+)\/screenshot$/.exec(pathname);
    if (!match) return false;

    if (req.method !== "GET") {
      res.writeHead(405).end();
      return true;
    }
    const id = match[1]!;
    const file = isUuid(id) ? await getScreenshot(db, id) : null;
    if (!file) {
      res.writeHead(404, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "Not found" }));
      return true;
    }
    res.writeHead(200, {
      "content-type": file.mimeType,
      "content-length": file.content.length,
      "x-content-type-options": "nosniff",
      "cache-control": "private, no-store",
    });
    res.end(file.content);
    return true;
  };
}
