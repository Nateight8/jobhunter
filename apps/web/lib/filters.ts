import type {
  BoardFilterFieldsFragment,
  BoardFilterInput,
  JobFilter,
  RemoteType,
} from "./gql/graphql";

export type FeedFilters = {
  q: string;
  stack: string[];
  remote: RemoteType[];
  startup: boolean;
  titleIncludes: string[];
  titleExcludes: string[];
  // Saved with a board but not editable in the form; passed through untouched.
  sources: string[];
  startupMax: number | null;
};

export const EMPTY_FILTERS: FeedFilters = {
  q: "",
  stack: [],
  remote: [],
  startup: false,
  titleIncludes: [],
  titleExcludes: [],
  sources: [],
  startupMax: null,
};

export const REMOTE_OPTIONS: { value: RemoteType; label: string }[] = [
  { value: "REMOTE", label: "Remote" },
  { value: "HYBRID", label: "Hybrid" },
  { value: "ONSITE", label: "On-site" },
];

const REMOTE_VALUES = new Set<string>(REMOTE_OPTIONS.map((o) => o.value));
export const isRemote = (v: string): v is RemoteType => REMOTE_VALUES.has(v);

export const csv = (s: string | null | undefined): string[] =>
  (s ?? "")
    .split(/[,\n]/)
    .map((x) => x.trim())
    .filter(Boolean);

export function boardToFilters(f: BoardFilterFieldsFragment): FeedFilters {
  return {
    q: f.search ?? "",
    stack: f.stack ?? [],
    remote: f.remoteTypes ?? [],
    startup: f.startupOnly ?? false,
    titleIncludes: f.titleIncludes ?? [],
    titleExcludes: f.titleExcludes ?? [],
    sources: f.sources ?? [],
    startupMax: f.startupMaxBoardSize ?? null,
  };
}

// URL = a board's saved filter plus per-field overrides. A key that is present, even empty, wins.
export const OVERRIDE_KEYS = ["q", "stack", "remote", "startup", "tin", "tex"] as const;

export const hasOverrides = (p: URLSearchParams) => OVERRIDE_KEYS.some((k) => p.has(k));

export function readFilters(p: URLSearchParams, base: FeedFilters = EMPTY_FILTERS): FeedFilters {
  return {
    ...base,
    q: p.has("q") ? (p.get("q") ?? "") : base.q,
    stack: p.has("stack") ? csv(p.get("stack")) : base.stack,
    remote: p.has("remote") ? csv(p.get("remote")).filter(isRemote) : base.remote,
    startup: p.has("startup") ? p.get("startup") === "1" : base.startup,
    titleIncludes: p.has("tin") ? csv(p.get("tin")) : base.titleIncludes,
    titleExcludes: p.has("tex") ? csv(p.get("tex")) : base.titleExcludes,
  };
}

const same = (a: string[], b: string[]) => a.join("\u0000") === b.join("\u0000");

/** Only the fields that differ from the base are written, so the URL stays short. */
export function writeOverrides(base: FeedFilters, f: FeedFilters): URLSearchParams {
  const p = new URLSearchParams();
  if (f.q !== base.q) p.set("q", f.q);
  if (!same(f.stack, base.stack)) p.set("stack", f.stack.join(","));
  if (!same(f.remote, base.remote)) p.set("remote", f.remote.join(","));
  if (f.startup !== base.startup) p.set("startup", f.startup ? "1" : "0");
  if (!same(f.titleIncludes, base.titleIncludes)) p.set("tin", f.titleIncludes.join(","));
  if (!same(f.titleExcludes, base.titleExcludes)) p.set("tex", f.titleExcludes.join(","));
  return p;
}

// Always rebuild clean objects: Apollo results carry __typename, which GraphQL rejects in inputs.
export function toGraphqlFilter(f: FeedFilters): JobFilter {
  return {
    search: f.q || undefined,
    stack: f.stack.length ? f.stack : undefined,
    remoteTypes: f.remote.length ? f.remote : undefined,
    sources: f.sources.length ? f.sources : undefined,
    startupOnly: f.startup || undefined,
    startupMaxBoardSize: f.startup && f.startupMax ? f.startupMax : undefined,
    titleIncludes: f.titleIncludes.length ? f.titleIncludes : undefined,
    titleExcludes: f.titleExcludes.length ? f.titleExcludes : undefined,
  };
}

export function filtersToBoardInput(f: FeedFilters): BoardFilterInput {
  return {
    search: f.q || null,
    stack: f.stack,
    remoteTypes: f.remote,
    sources: f.sources,
    startupOnly: f.startup,
    startupMaxBoardSize: f.startup ? f.startupMax : null,
    titleIncludes: f.titleIncludes,
    titleExcludes: f.titleExcludes,
  };
}

/** The filter in plain words, so a board's name never has to explain it. */
export function describeFilter(f: FeedFilters): string {
  const parts: string[] = [];
  if (f.q) parts.push(`Search "${f.q}"`);
  if (f.stack.length) parts.push(`Stack: ${f.stack.join(", ")}`);
  if (f.remote.length) {
    const labels = f.remote.map((r) => REMOTE_OPTIONS.find((o) => o.value === r)?.label ?? r);
    parts.push(labels.join(" or "));
  }
  if (f.startup) parts.push("Startups only");
  if (f.titleIncludes.length) parts.push(`Title has: ${f.titleIncludes.join(", ")}`);
  if (f.titleExcludes.length) parts.push(`Title excludes: ${f.titleExcludes.join(", ")}`);
  if (f.sources.length) parts.push(`Sources: ${f.sources.join(", ")}`);
  return parts.length ? parts.join(" · ") : "No filters (shows everything)";
}
