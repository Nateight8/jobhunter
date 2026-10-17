import type { RemoteType } from "./gql/graphql";

export type FeedFilters = {
  q: string;
  stack: string[];
  remote: RemoteType[];
  startup: boolean;
};

export const REMOTE_OPTIONS: { value: RemoteType; label: string }[] = [
  { value: "REMOTE", label: "Remote" },
  { value: "HYBRID", label: "Hybrid" },
  { value: "ONSITE", label: "On-site" },
];

const REMOTE_VALUES = new Set<string>(REMOTE_OPTIONS.map((o) => o.value));

const split = (s: string | null) =>
  (s ?? "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

// URL is the source of truth: ?q=&stack=react,node&remote=REMOTE,HYBRID&startup=1
export function readFilters(p: URLSearchParams): FeedFilters {
  return {
    q: p.get("q") ?? "",
    stack: split(p.get("stack")),
    remote: split(p.get("remote")).filter((r): r is RemoteType => REMOTE_VALUES.has(r)),
    startup: p.get("startup") === "1",
  };
}

export function toGraphqlFilter(f: FeedFilters) {
  return {
    search: f.q || undefined,
    stack: f.stack.length ? f.stack : undefined,
    remoteTypes: f.remote.length ? f.remote : undefined,
    startupOnly: f.startup || undefined,
  };
}
