const GRAPHQL_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/graphql";
export const API_BASE = GRAPHQL_URL.replace(/\/graphql\/?$/, "");

/** Uploads a CV over plain HTTP (files don't go through GraphQL). */
export async function uploadCv(file: File): Promise<{ id: string }> {
  const body = new FormData();
  body.append("kind", "cv");
  body.append("file", file);

  let res: Response;
  try {
    res = await fetch(`${API_BASE}/documents`, { method: "POST", body });
  } catch {
    throw new Error("Couldn't reach the API. Is `make api` running?");
  }
  const json = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
  if (!res.ok || !json.id) throw new Error(json.error ?? "Upload failed");
  return { id: json.id };
}
