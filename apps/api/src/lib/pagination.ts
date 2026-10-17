// Keyset cursors over (timestamp, uuid). Plain errors only: no GraphQL imports here.

export class InvalidCursorError extends Error {
  constructor() {
    super("Invalid cursor");
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TS = /^\d{4}-\d\d-\d\d[ T][\d:.]+(Z|[+-]\d\d(:?\d\d)?)?$/;

export const isUuid = (s: string) => UUID.test(s);

export const clampFirst = (first: number, max = 100) => Math.min(Math.max(first, 1), max);

export const encodeCursor = (ts: string, id: string) =>
  Buffer.from(`${ts}|${id}`).toString("base64url");

export function decodeCursor(cursor: string): { ts: string; id: string } {
  const [ts, id] = Buffer.from(cursor, "base64url").toString().split("|");
  if (!ts || !id || !TS.test(ts) || !UUID.test(id)) throw new InvalidCursorError();
  return { ts, id };
}
