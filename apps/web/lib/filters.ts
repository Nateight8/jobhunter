import type {
  BoardFilterFieldsFragment,
  BoardFilterInput,
  JobFilter,
  RemoteType,
} from "./gql/graphql";

// A board's saved filter. Adding a filter means a field here, in the helpers below, and in the editor.
export type FeedFilters = {
  q: string;
  stack: string[];
  remote: RemoteType[];
  startup: boolean;
  startupMax: number | null;
  titleIncludes: string[];
  titleExcludes: string[];
  sources: string[];
  regions: string[]; // region codes
};

export const EMPTY_FILTERS: FeedFilters = {
  q: "",
  stack: [],
  remote: [],
  startup: false,
  startupMax: null,
  titleIncludes: [],
  titleExcludes: [],
  sources: [],
  regions: [],
};

export const REMOTE_OPTIONS: { value: RemoteType; label: string }[] = [
  { value: "REMOTE", label: "Remote" },
  { value: "HYBRID", label: "Hybrid" },
  { value: "ONSITE", label: "On-site" },
];

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
    startupMax: f.startupMaxBoardSize ?? null,
    titleIncludes: f.titleIncludes ?? [],
    titleExcludes: f.titleExcludes ?? [],
    sources: f.sources ?? [],
    regions: f.regions ?? [],
  };
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
    regions: f.regions.length ? f.regions : undefined,
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
    regions: f.regions,
  };
}

/** The filter in plain words, so a board's name never has to explain it. */
export function describeFilter(f: FeedFilters, regionNames: Record<string, string> = {}): string {
  const parts: string[] = [];
  if (f.regions.length) parts.push(`Regions: ${f.regions.map((c) => regionNames[c] ?? c).join(", ")}`);
  if (f.q) parts.push(`Search "${f.q}"`);
  if (f.stack.length) parts.push(`Stack: ${f.stack.join(", ")}`);
  if (f.remote.length) {
    parts.push(f.remote.map((r) => REMOTE_OPTIONS.find((o) => o.value === r)?.label ?? r).join(" or "));
  }
  if (f.startup) parts.push("Startups only");
  if (f.titleIncludes.length) parts.push(`Title has: ${f.titleIncludes.join(", ")}`);
  if (f.titleExcludes.length) parts.push(`Title excludes: ${f.titleExcludes.join(", ")}`);
  if (f.sources.length) parts.push(`Sources: ${f.sources.join(", ")}`);
  return parts.length ? parts.join(" · ") : "No filters (shows everything)";
}
