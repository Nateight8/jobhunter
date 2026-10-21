# jobhunter — Developer Handbook

This is the as-built reference for the repo: what every folder, file and module does, how the pieces connect, and where the sharp edges are. It is written for a developer joining cold. `docs/PRD.md` describes intent; this file describes what exists. Where they disagree, the code wins.

⚠️ marks a known gap or footgun. The full list is in the last section.

## Table of Contents

1. [Status at a Glance](#status-at-a-glance)
2. [Folder Structure](#folder-structure)
3. [How the Pieces Fit](#how-the-pieces-fit)
4. [Running It](#running-it)
5. [Database (`packages/db`)](#database-packagesdb)
6. [Pipeline (`pipeline/`)](#pipeline-pipeline)
7. [Shared Data (`shared/regions.json`)](#shared-data)
8. [API Foundation (`apps/api/src`)](#api-foundation)
9. [API Modules](#api-modules) — jobs, profile, documents, boards, applications, memory, forms, apply
10. [The Runner (`apps/api/src/runner`)](#the-runner)
11. [Web (`apps/web`)](#web-appsweb)
12. [Conventions and Samples](#conventions-and-samples)
13. [Appendix: Cross-Cutting Concepts](#appendix-cross-cutting-concepts)
14. [Known Gaps and Flags](#known-gaps-and-flags)

---

## Status at a Glance

| Area | State |
|---|---|
| Pipeline ingestion (6 sources, slug harvest, stale-job closing, board health, `make scrape-all`) | Verified by running (about 7k jobs stored) |
| Region enrichment (`make enrich`) | Verified by running (87% of jobs classified) |
| GraphQL API: jobs feed, filters, cursor pagination, boards | Verified through the UI |
| Profile and CV extraction with Gemini | Verified end to end |
| Boards UI (tab bar, editor, presets, boards page) | Verified through the UI |
| Memory page | Works; UI is basic |
| Applications tracker and apply panel | Written; not yet reported on after use |
| Application form (Greenhouse questions on the job page) | Written; not yet reported on after use |
| Auto-fill runner (Playwright) | Written; never run against a real form. Needs Playwright installed and a clean typecheck first |
| Automated tests and CI | None |
| Authentication | None (single user, localhost only) |

---

## Folder Structure

```
jobhunter/
├── .env                          Local config and secrets (gitignored)
├── .env.example                  Template; committed
├── docker-compose.yml            Postgres 17 only
├── Makefile                      Entry points for everything below
├── package.json, pnpm-workspace.yaml, turbo.json, tsconfig.json
│                                 From the shadcn monorepo template (Turborepo + pnpm)
├── AGENTS.md, CLAUDE.md          Template leftovers
├── docs/
│   ├── PRD.md                    Product intent and decisions log
│   └── HANDBOOK.md               This file
├── shared/
│   └── regions.json              Region/alias rules read by BOTH Python and the API
├── data/                         Gitignored. The runner's browser profile lives here
│
├── packages/
│   ├── db/                       Drizzle schema + migrations (schema owner)
│   │   ├── drizzle.config.ts
│   │   ├── drizzle/              Generated SQL migrations (committed)
│   │   └── src/
│   │       ├── index.ts          createDb(url) + re-exports the schema
│   │       └── schema/
│   │           ├── index.ts      Re-exports every table file
│   │           ├── _shared.ts    tz() timestamptz helper, bytea custom type
│   │           ├── companies.ts, jobs.ts, scrape-runs.ts
│   │           ├── profile.ts    profiles, experiences, education, projects, skills
│   │           ├── documents.ts  documents (metadata), document_files (bytes)
│   │           ├── profile-drafts.ts
│   │           ├── boards.ts, applications.ts
│   │           ├── answers.ts    Backs the "Memory" feature
│   │           ├── job-forms.ts  job_forms (cache), job_answers
│   │           └── apply-runs.ts apply_runs, apply_run_files
│   ├── ui/                       shadcn components (base-lyra); barely used so far
│   └── eslint-config/, typescript-config/
│
├── pipeline/                     Python (uv). Scrapes, normalizes, enriches. Writes Postgres
│   ├── pyproject.toml, uv.lock
│   ├── sources.toml              Bootstrap slugs + per-source settings
│   └── jobhunter/
│       ├── __main__.py, cli.py   Commands: scrape, harvest, enrich, all
│       ├── db.py                 Raw-SQL writer (upsert, close stale, board health)
│       ├── models.py             RawJob (pydantic)
│       ├── normalize.py          remote-type inference, dedupe key
│       ├── harvest.py            Finds ATS board slugs in stored jobs
│       ├── regions.py            Location text → region codes
│       ├── enrich.py             Writes jobs.regions, prints the report
│       └── sources/
│           ├── __init__.py       build_source(), slug assembly
│           ├── base.py           Source and BoardSource base classes
│           ├── greenhouse.py, lever.py, ashby.py      Per-company ATS boards
│           └── remoteok.py, remotive.py, hackernews.py  Aggregators
│
└── apps/
    ├── api/                      Node/TypeScript. GraphQL (Yoga + Pothos), HTTP routes, runner
    │   ├── schema.graphql        GENERATED from the code; committed
    │   └── src/
    │       ├── index.ts          Server entry: HTTP routes + GraphQL
    │       ├── builder.ts        Pothos builder, single Query/Mutation roots
    │       ├── schema.ts         Imports every module, builds the schema
    │       ├── graphql-errors.ts guard(): ValidationError → GraphQLError
    │       ├── lib/              db.ts, errors.ts, validate.ts, pagination.ts, gemini.ts, regions.ts
    │       ├── scripts/print-schema.ts
    │       ├── modules/          One folder per feature (see API Modules)
    │       │   ├── jobs/  profile/  documents/  boards/
    │       │   └── applications/  memory/  forms/  apply/
    │       └── runner/           Separate process: Playwright auto-fill (index, db, browser, fill-greenhouse, process)
    │
    └── web/                      Next.js 16 + React 19 + Apollo Client
        ├── codegen.ts            Reads ../api/schema.graphql
        ├── app/                  Routes: /, /[jobid], /boards, /profile, /applications, /memory, error.tsx
        ├── components/           UI (profile/ subfolder for the profile form)
        └── lib/                  Queries, filter helpers, hooks, sanitizer; gql/ is generated (gitignored)
```

**Pattern to note:** the API is organised by feature, not by layer. Each `modules/<feature>/` folder holds its own GraphQL types, resolvers (thin), service (all DB logic) and, where needed, filters or HTTP routes. The web app mirrors that with one `*-queries.ts` file per feature in `lib/`. Postgres is the only link between the Python pipeline and everything else.

---

## How the Pieces Fit

```
 Python pipeline ──writes──▶ PostgreSQL ◀──reads/writes── API (Yoga + Pothos) ◀── Next.js web
 (scrape, enrich)         (Drizzle schema)               + HTTP routes             (Apollo Client)
                                ▲                                ▲
                                └──── Runner (Playwright) ───────┘  polls apply_runs, fills forms in Chrome
```

### Flow 1: loading the feed
1. `/` renders `BoardBar` and `JobList`. `useFeedFilters` reads `?board=<id>`, finds that board in the `boards` query, and turns its saved filter into a `FeedFilters` object. No board in the URL means "All" (empty filter).
2. `JobList` runs the `jobs(filter, first: 25, after)` query via `useSuspenseQuery`. Apollo's `typePolicies` key the list by `filter` and append pages when `after` is set.
3. The API's `listJobs` builds SQL from the filter, joins `companies` (board size) and `applications` (your own status), orders by `(first_seen_at desc, id desc)`, fetches `first + 1` rows to know if another page exists, and returns edges with opaque cursors.

### Flow 2: CV to profile
1. The browser POSTs the file to `/documents` (plain HTTP). The API validates the bytes, stores metadata in `documents` and the file in `document_files`, and makes it the default CV.
2. `extractProfile(documentId)` sends the PDF (or DOCX text) to Gemini with a JSON schema, normalizes the result and saves a `profile_drafts` row.
3. The review form is prefilled from the draft. `confirmProfile` writes every section in one transaction, computes years of experience, and seeds the Recommended board the first time.

### Flow 3: applying with auto-fill (Greenhouse)
1. The job page calls `jobForm(jobId)`: the API fetches the posting's questions from Greenhouse's public API (cached 12 hours) and resolves each answer from your job answers, profile or memory.
2. `startApply(jobId)` inserts an `apply_runs` row with status `queued`.
3. The runner process claims it, opens a visible Chrome window, fills the form and sets `needs_you`. It never presses Submit.
4. The runner watches the page. When the form disappears and a confirmation appears, it stores a screenshot, marks the job `applied` in the tracker and sets `submitted`.
5. The web page polls the run every 2 seconds while it is active.

---

## Running It

### Prerequisites
Docker, Node 22 (via nvm), pnpm 11, `uv` (Python), and Google Chrome (for the runner).

### Environment variables (root `.env`)

| Variable | Used by | Meaning |
|---|---|---|
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT` | docker-compose | Container settings. Port defaults to 5432; set 5433 if 5432 is taken |
| `DATABASE_URL` | pipeline, API, drizzle-kit | Connection string |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | API | CV extraction. Model names retire often; list what your key can use before choosing |
| `WEB_ORIGIN` | API | CORS and upload origin check. Default `http://localhost:3000` |
| `API_PORT`, `API_HOST`, `API_PUBLIC_URL` | API | Default 4000, `127.0.0.1`, `http://localhost:<port>` |
| `NEXT_PUBLIC_API_URL` | web | GraphQL URL. Default `http://localhost:4000/graphql`. Browser-visible by design |
| `RUNNER_BROWSER`, `RUNNER_PROFILE_DIR`, `RUNNER_INSPECT` | runner | `chrome` (default) or `chromium`; browser profile folder; `1` logs form controls |

Never put secrets in a `NEXT_PUBLIC_` variable: Next.js ships those to the browser. Only the API needs the Gemini key.

### Makefile targets

| Target | What it does |
|---|---|
| `make up` / `make down` | Start/stop Postgres |
| `make migrate` | Apply existing migrations (`generate` is separate: `pnpm --filter @workspace/db generate`) |
| `make scrape SOURCE=<name>` | One source |
| `make scrape-all [SKIP="a b"]` | Discovery sources → harvest → ATS boards → harvest → enrich |
| `make harvest`, `make enrich` | Run those steps alone (both work from stored data) |
| `make api`, `make web` | Dev servers (ports 4000 and 3000) |
| `make runner` | The auto-fill runner (separate process; keep it running) |
| `make schema` | Regenerate `apps/api/schema.graphql` |
| `make psql` | psql into the container |

### After changing the API schema
Run `make schema`. The web app's `predev`, `prebuild` and `pretypecheck` scripts run graphql-codegen against that file, so types update automatically.

⚠️ pnpm 11 refuses to finish an install while any dependency has an unreviewed install script (`ERR_PNPM_IGNORED_BUILDS`). Set the package to `false` under `allowBuilds` in `pnpm-workspace.yaml`.

---

## Database (`packages/db`)

### Conventions
- Drizzle owns the schema. The Python pipeline writes the same tables with hand-written SQL.
- `text` columns with lowercase string values instead of Postgres enums (`remote_type`, `status`, `kind`, …). Easy to change, mirrored by Pothos enums on the API side.
- `timestamptz` everywhere, uuid primary keys, snake_case columns.
- Ordered lists carry a `position` column. Replace-the-whole-list is the write pattern.
- File bytes live in their own table (`bytea`), so listing metadata never loads files.
- Personal data lives only in tables keyed by `profile_id`. `jobs` and `companies` are public data.

### Tables

**`companies`**: one row per ATS board. `ats_type` + `ats_slug` unique. `enabled`, `fail_count`, `last_error` implement board health; `open_jobs` is the board's size at the last good scrape (the startup signal); `last_scraped_at`.

**`jobs`**: public job data. Unique `(source, source_id)` is the upsert target. Key columns: `title`, `company_name`, `location`, `remote_type`, `description` (raw HTML), `posted_at`, `first_seen_at`, `last_seen_at`, `closed_at`, `dedupe_key`, `regions text[]` (GIN index, written by enrich), `raw jsonb`. ⚠️ `company_id`, `status`, `score` and the `salary_*` columns exist but nothing populates them yet.

**`scrape_runs`**: one row per scrape (source, counts, error). Written by the pipeline; nothing reads it yet.

**`profiles`**: single row by convention (identity, links, `years_experience`, `authorized_regions`, `confirmed_at`). **`experiences`**, **`education`**, **`projects`**, **`skills`** hang off it with `position`.

**`documents`** (metadata; at most one default per kind via a partial unique index) and **`document_files`** (bytes).

**`profile_drafts`**: CV-extraction results. Status: `pending | ready | failed | confirmed | discarded`.

**`boards`**: a saved search: `name`, `position`, `kind` (`recommended` or null), `filter jsonb`.

**`applications`**: your own state for a job. Unique `(profile_id, job_id)`. Status: `saved | applied | interviewing | offer | rejected | hidden`; `applied_at` is stamped once.

**`answers`**: backs Memory (remembered question/answer pairs). ⚠️ `key` and `position` are legacy from the earlier "answers bank" and are unused now. The table name differs from the API name on purpose (renaming makes drizzle-kit ask an interactive question).

**`job_forms`**: cached Greenhouse application form per job. **`job_answers`**: your planned answer per `(profile, job, field_name)`, with `source` (`you | memory | suggested`) and `status` (`accepted | suggested`). Only accepted rows are used.

**`apply_runs`**: one row per auto-fill attempt. Status: `queued | opening | filling | needs_you | submitted | closed | failed | abandoned`. `report` holds per-field outcomes; `log` holds timestamped lines. **`apply_run_files`**: confirmation screenshot (`bytea`).

### Migrations
`pnpm --filter @workspace/db generate` writes SQL into `packages/db/drizzle/`; `migrate` applies it. Commit the generated files. The Python SQL in `pipeline/jobhunter/db.py` does not read them; see the flags section.

---

## Pipeline (`pipeline/`)

Python 3.11+, `uv`. Its only job is to get public job data into Postgres and then enrich it. It never reads or writes personal data.

### `cli.py`
Four commands: `scrape <source> [--dry-run]`, `harvest`, `enrich [--dry-run] [--sample N]`, `all [--skip ...]`. `all` runs, in order: discovery sources (RemoteOK, Remotive, Hacker News) → harvest → board sources (Greenhouse, Lever, Ashby) → harvest → enrich. Each step is wrapped so one failure doesn't stop the rest; a summary prints at the end and the exit code is non-zero if anything failed. Board sources are built after the first harvest, so newly found slugs are scraped in the same run.

### `db.py`: the writer
- **`upsert_jobs`**: `INSERT … ON CONFLICT (source, source_id) DO UPDATE`. On conflict it refreshes content, sets `last_seen_at = now()` and clears `closed_at` (a reappearing job reopens). It does not touch `regions`, `status`, `score` or `first_seen_at`. Returns `(seen, new)` using the `xmax = 0` insert trick.
- **`close_stale`**: after a successful scrape, marks jobs not seen this run as closed. Board sources (Greenhouse, Lever, Ashby) are handled per board, only for boards that returned at least one job, so a timeout or 404 can't close a company's listings. Single-feed sources close only if the feed returned at least one job. Hacker News postings fall out when they leave the two-thread window.
- **`record_board_results` / `MAX_FAILS = 5`**: per-board success resets `fail_count`; a failure increments it and disables the board at 5. ⚠️ If no board in a run succeeded, nothing is recorded (an outage must not disable every board).
- **`ats_slugs` / `disabled_slugs`**: `sources/__init__._slugs()` unions `sources.toml` with the table, minus disabled.
- `start_run` / `finish_run` write `scrape_runs`. The connection uses autocommit.

### `sources/`
- **`Source`** (abstract): `fetch() -> list[RawJob]`. **`BoardSource`**: for per-company boards; subclasses give `url(slug)`, `params`, `parse(slug, data)`. It handles concurrency (5), a 60-second per-board cap, and records `results[slug] = (count, error)`.
- **Greenhouse** (`boards-api.greenhouse.io/v1/boards/{slug}/jobs?content=true`), **Lever** (`api.lever.co/v0/postings/{slug}`), **Ashby** (`api.ashbyhq.com/posting-api/job-board/{slug}`). `source_id` is `slug:jobid`. ⚠️ Lever and Ashby don't return a display name, so `company_name` is the slug.
- **RemoteOK** and **Remotive**: single requests. Remotive's public feed is tiny (about 15 jobs). Both require attribution and a link back; the UI shows the source name and links to the original.
- **Hacker News**: finds the latest "Who is hiring?" threads through Algolia and stores each top-level comment whose first line contains `|`. ⚠️ Parsing is best effort (a title can come out as "ONSITE", a URL can end up in a company name).

### `harvest.py`
Regex-scans every stored job's `url`, `apply_url` and description for Greenhouse/Lever/Ashby board links, and inserts new slugs (lowercased) into `companies`. HN postings are the main discovery source.

### `normalize.py`
`infer_remote_type` (substring: "hybrid" beats "remote"; otherwise unknown) and `dedupe_key` (sha1 of normalized company + title + location). ⚠️ The key is stored but not used by any query yet.

### `regions.py` and `enrich.py`
`classify_job(source, location, raw)` turns a free-text location into region codes using `shared/regions.json`; it also reads Lever's `allLocations` and `country` and Ashby's `secondaryLocations`. `None` means "nothing usable": it never guesses. `enrich` classifies every stored job and writes `jobs.regions`, prints classification rates per source, top regions and the most common unclassified locations. It re-runs from stored data, so improving the rules means editing the JSON and running `make enrich`, not re-scraping.

Rules worth knowing: an explicit state/country name beats a city; a trailing two-letter code that agrees with the city's country is that country (`Berlin, DE`), otherwise it is a US state or Canadian province (`Cambridge, MA`); `Anywhere` means worldwide unless followed by "in <place>".

---

## Shared Data

`shared/regions.json` is the single source of region rules: region codes and aliases, US state and Canadian province names and abbreviations, and a city table. Python reads it to classify; the API reads it (`lib/regions.ts`) to validate board region codes and show names. Adding a place means editing this file, then `make enrich`.

---

## API Foundation

### `src/index.ts`
One Node HTTP server. Request order: documents routes (`/documents…`), apply routes (`/apply-runs/:id/screenshot`), then Yoga (GraphQL at `/graphql`, with GraphiQL). Binds to `127.0.0.1` by default (set `API_HOST=0.0.0.0` inside Docker). CORS allows `WEB_ORIGIN` only.

### `src/builder.ts`
The Pothos `SchemaBuilder` with `Context: { db }` and `defaultFieldNullability: false`: **fields are non-null unless a field says `nullable: true`**. It declares the single `Query` and `Mutation` roots; every module then adds fields with `builder.queryFields(...)` and `builder.mutationFields(...)`. Pothos allows only one root type, so never call `builder.queryType` again.

### `src/schema.ts`
Imports each module's `index.ts` for side effects and calls `builder.toSchema()`. Adding a module means a folder plus one import line here.

### `src/graphql-errors.ts`: `guard(fn)`
Wraps a service call in a resolver. A `ValidationError` becomes a `GraphQLError` with code `BAD_USER_INPUT`; anything else stays masked by Yoga as an unexpected error.

### `src/lib/`
- **`db.ts`**: loads the root `.env`, creates the Drizzle client, exports `db` and the `Db` type. Throws if `DATABASE_URL` is missing.
- **`errors.ts`**: `ValidationError`, the only error services throw on purpose.
- **`validate.ts`**: `str`, `requiredStr`, `email`, `phone`, `url`, `int`, `list`, `month`. Semantics everywhere: **`undefined` = leave unchanged, `null` = clear, empty string = `null`**. URLs without a scheme get `https://`. Dates accept `YYYY-MM` and store the first of the month.
- **`pagination.ts`**: keyset cursors over `(timestamp, uuid)`. The cursor carries the timestamp as `::text` so Postgres microsecond precision survives (JS `Date` would truncate it). `clampFirst` caps page size at 100.
- **`gemini.ts`**: `geminiConfig()` (throws a readable error if the key or model is missing) and `generateJson()` (structured output via `responseJsonSchema`, temperature 0, 120-second timeout). HTTP errors are mapped to friendly messages: 429 rate limit, 404 model not found, 400/401/403 bad key or model.
- **`regions.ts`**: reads `shared/regions.json` for `isRegionCode` and `regionName`.

### `src/scripts/print-schema.ts`
Prints the sorted SDL to `apps/api/schema.graphql`. The code is the source of truth; never edit the generated file by hand.

---

## API Modules

Each module follows the same layout: `*.service.ts` (all DB logic, no GraphQL imports), `*.types.ts` (Pothos types), `*.queries.ts`, `*.mutations.ts`, `index.ts`. Cross-module fields are attached with `builder.objectField` (for example, `Profile.documents` lives in the documents module, and `Job.applicationStatus` in the applications module), so modules don't import each other's resolvers.

### `modules/jobs`

**`jobs.filters.ts`**: `JobFilterInput` and `buildConditions(filter)`, the only place filters become SQL:
- closed jobs hidden unless `includeClosed`
- jobs you applied to, hid, or are tracking beyond "saved" hidden unless `includeTracked`
- `remoteTypes`, `sources`: `IN`
- `search`: `ILIKE` on title or company
- `stack`: any keyword, whole-word, case-insensitive regex on title **or** description
- `titleIncludes`: any keyword in the title; `titleExcludes`: none of them in the title
- `regions`: array overlap with `jobs.regions`; jobs with no region are excluded when this is set
- `startupOnly`: `companies.open_jobs < startupMaxBoardSize` (default 50); only jobs from a known ATS board can pass

**`jobs.service.ts`**: `jobColumns` (also selects `boardSize` from `companies.open_jobs`, `applicationStatus`, and the full-precision `cursorTs`), `boardJoin` (joins `companies` by `ats_type = source AND ats_slug = split_part(source_id, ':', 1)`, because `jobs.company_id` is not populated), `listJobs`, `getJob`, `getJobDescription`, `countJobsCapped(cap = 500)` and `listRegionOptions`. `description` is never selected in lists; `getJob` includes it.

**`jobs.types.ts`**: `RemoteType` enum (`REMOTE` ↔ `"remote"`), `JobFilter` input, `Job`, connection types. `Job.description` resolves lazily, so asking for it in a list costs a query per job.

**Queries**: `jobs(filter, first = 25, after)`, `job(id)`, `regionOptions` (regions present in open jobs, with counts).

### `modules/profile`

The profile is a singleton: `getOrCreateProfile(db)` returns the oldest `profiles` row, creating it if missing. Every service uses it.

**`profile.service.ts`**
- `saveProfile`: partial update.
- `replaceExperiences / Education / Projects / Skills`: replace a whole list inside a transaction; `position` is the array index. Skills dedupe case-insensitively.
- `confirmProfile(input, draftId?)`: validates everything first, requires name, email, phone, country and at least one authorized region, then in one transaction updates the profile, replaces every list, sets `confirmed_at`, computes `years_experience` and marks the draft `confirmed`.
- `computeYears`: merges overlapping role spans so concurrent jobs aren't double-counted, then floors months/12 (capped at 60).
- `readiness`: which of `fullName, email, phone, country, authorizedRegions, cv` are still missing.

**CV extraction**
- `extract.service.ts`: `extractProfile(db, documentId)`. Requires Gemini config (throws a readable error otherwise, creating no draft). Checks the document is the caller's CV, discards any live draft, inserts a `pending` draft, calls Gemini, validates the JSON, normalizes it and sets `ready`. **Extraction failures do not throw: they save a `failed` draft with a readable `error`**, so the UI can show it.
- PDFs go to Gemini directly (scans usually work, with lower accuracy); DOCX files are converted to text with `mammoth` first.
- The system prompt: extract only what is written, null for anything missing, dates as `YYYY-MM`, never infer, and treat the document as untrusted data (ignore instructions inside it).
- `extraction.schema.ts`: the Zod schema, converted with `z.toJSONSchema` (the older `zod-to-json-schema` package breaks with Zod 4). `extraction.normalize.ts`: trims text, lowercases email, turns a bare year into January of that year, drops empty entries, dedupes skills, caps list sizes.
- Years of experience is never extracted; it is computed on confirm.

**GraphQL**: `Profile` (with `readiness`, `draft`, `documents`), `saveProfile`, `saveExperiences/Education/Projects/Skills`, `extractProfile` (returns the `Profile`, so Apollo's cache updates), `discardDraft`, `confirmProfile`. Input types are optional-field, matching the `undefined`/`null` rule.

`confirm.mutations.ts` also seeds the Recommended board the **first** time a profile is confirmed (failure is logged, never fails the save).

### `modules/documents`
- **`documents.service.ts`**: `detectType` decides the type from the file's bytes (`%PDF-`, or a ZIP containing `word/document.xml` for DOCX); filename and client MIME are never trusted. Limits: 10 MB, 50 documents. The newest upload of a kind becomes the default (the previous default is kept, unset). `setDefaultDocument`, `deleteDocument` (promotes the newest remaining of that kind).
- **`documents.http.ts`**: `POST /documents` (multipart) and `GET /documents/:id`. The upload route **refuses requests whose `Origin` isn't `WEB_ORIGIN`**: a multipart POST needs no CORS preflight, so without this check any website open in your browser could post files to `localhost:4000`. Bytes are served with `nosniff` and `no-store`.
- GraphQL: `Profile.documents` (metadata plus `downloadUrl`), `setDefaultDocument`, `deleteDocument`. File bytes never travel through GraphQL.

### `modules/boards`
A board is `name + filter + position`, owned by the profile. "All" is not a board: it is the feed with no `?board=`.

- **`boards.filter.ts`**: reading is permissive (a Zod schema with `.catch`, so a bad or unknown saved field becomes "not set" and can't break the feed); writing is strict (`normalizeFilter` trims, drops empties and unknown region codes).
- **`boards.service.ts`**: create (max 20 boards), update, delete (renumbers positions), reorder (the ids must be exactly the current set), `recommendedFilter` (technologies from your experience entries, newer roles weighted more, top 8; falls back to your first 8 skills), `seedRecommendedBoard` and `resetRecommendedBoard`.
- **`presets.ts`** loads `presets/*.json` once at startup (DevOps, Frontend, Backend, Internships, Remote startups). Add a preset by adding a JSON file and restarting.
- GraphQL: `boards`, `boardPresets`, `createBoard`, `updateBoard`, `deleteBoard`, `reorderBoards`, `resetRecommendedBoard`. `Board.count` returns `{ value, capped }` (500 cap), computed on request, so the web app asks for it in a separate query from the list.

### `modules/applications`
- Status values: `saved, applied, interviewing, offer, rejected, hidden`. Moving to `applied` (or later) stamps `applied_at` once (`coalesce`), never overwritten.
- `setApplicationStatus` upserts, `setApplicationNotes` requires an existing record, `removeApplication` forgets your state (unsave, restore, undo).
- `Job.applicationStatus` is selected by the jobs query's join (cheap); `Job.application` runs one query, so request it on a single job only.
- Hiding is personal: it never touches the shared `jobs` row.

### `modules/memory`
Remembered answers, stored in `answers`. Starts empty; entries exist only with the user's approval. `normalizeQuestion` lowercases and strips punctuation. Saving a question whose normalized wording already exists **updates** that entry instead of duplicating it; editing an entry into a duplicate of another is refused. Max 200. GraphQL: `memory`, `saveMemoryEntry`, `deleteMemoryEntry`; type `MemoryEntry`, enum `AnswerType` (`TEXT`, `YES_NO`).

### `modules/forms`
Greenhouse application forms, on demand.
- **`forms.greenhouse.ts`**: fetches `boards-api.greenhouse.io/v1/boards/{slug}/jobs/{id}?questions=true` (public, read-only) and parses it into questions (`text | textarea | select | multiselect | unsupported`), files (resume, cover letter, other attachments) and `hasSurvey` (optional EEOC or demographic questions exist; these are **never** filled). Standard fields (first/last name, email, phone) are skipped because the profile covers them.
- **`forms.service.ts`**: caches the parsed form in `job_forms` for 12 hours (falls back to a stale copy if a refresh fails), then resolves each question. **Resolution order: your answer for this job → your profile (LinkedIn, GitHub, portfolio, location) → memory → none.** A dropdown answer is used only if it exactly matches one of the options; multi-selects and unsupported field types are never resolved. `saveJobAnswer(..., remember)` stores a job answer and optionally a memory entry (a two-option Yes/No question is stored as type `yesno`). `clearJobAnswer`.
- GraphQL `JobForm` (its `id` is the job id, so mutation results update Apollo's cache automatically), `jobForm(jobId, refresh)`, `saveJobAnswer`, `clearJobAnswer`. Only `source = 'greenhouse'` jobs are supported; others return `supported: false` with a reason.

### `modules/apply`
- **`startApply(jobId)`** queues a run after checking: Greenhouse job, not closed, profile has name and email, a default CV exists, not already applied (the tracker), and no active run already exists (returns that run instead). It never opens a browser.
- `applyRun(jobId)` returns the latest run; `ApplyRun` exposes status, message, per-field `outcomes`, the last 30 log lines and `screenshotUrl`.
- **`apply.http.ts`**: `GET /apply-runs/:id/screenshot`.

---

## The Runner

`apps/api/src/runner/`, started with `make runner`. A **separate process** from the API: restarting the API never kills a browser window. It shares the API's services and Drizzle client and talks to the API only through Postgres (the `apply_runs` table).

- **`index.ts`**: on start, `markStale()` marks leftover `opening/filling/needs_you` runs as `abandoned` (their windows are gone). Then it loops: claim the oldest `queued` run, `processRun`, repeat (1.5-second idle poll). A thrown error sets the run to `failed` with a readable message.
- **`browser.ts`**: one visible, persistent browser context (profile in `data/browser-profile`, so a login or CAPTCHA you solve by hand sticks). Default is your installed Google Chrome (`channel: "chrome"`); `RUNNER_BROWSER=chromium` uses Playwright's own build (install with `pnpm --filter @workspace/api exec playwright install chromium`).
- **`process.ts`**: loads job, profile, fresh form and default CV; opens a page; `openForm` finds the form (hosted `job-boards.greenhouse.io/{slug}/jobs/{id}` first, then the posting's own URL, searching every iframe); calls `fillGreenhouse`; sets `needs_you` with a summary; then spawns `watch` in the background so the next queued job can start. `watch` polls every second for up to 45 minutes: window closed → `closed`; submission detected → screenshot saved, job marked `applied`, status `submitted`.
- **`fill-greenhouse.ts`**: fills first/last name (split from your full name), email (then waits a second for the form's background validation), phone (always flagged "check"), the CV (found by trying several selectors for the hidden file input), every question with a resolved answer (text via `fill`; dropdowns by opening the ARIA combobox and clicking the option; location by typing the city and clicking the matching suggestion, flagged "check"). Every field is its own try/catch and yields an outcome: `filled | check | left | failed`. Anything unresolved is left blank and outlined in red; "check" fields are outlined amber.
- **`detectSubmission`**: the form must be gone **and** the URL must contain `application_id=`/`/confirmation` or the page text must match a confirmation phrase. Both conditions avoid false positives from job descriptions that say "thank you for your interest".
- `RUNNER_INSPECT=1` logs the page's controls (ids, names, roles) into the run log, so selectors can be corrected from real pages.

**Hard rules:** no code path presses Submit; no CAPTCHA or emailed security code is ever solved; optional demographic questions, the education block and the cover letter are always left to the user. (`grep -rni submit apps/api/src/runner` should show only comments and detection code, never a click.)

---

## Web (`apps/web`)

Next.js 16 (App Router), React 19, Tailwind, Apollo Client 4 with `@apollo/client-integration-nextjs`. Hooks come from `@apollo/client/react`. Reads use `useSuspenseQuery`; errors surface in `app/error.tsx`. Every page sets `dynamic = "force-dynamic"` (the API must be running, so nothing is prerendered) and wraps its client component in `<Providers>` (`ApolloNextAppProvider`).

### Routes

| Route | Component | Purpose |
|---|---|---|
| `/` | `Feed` (`BoardBar`, `JobList`) | Tab bar of boards and the job list. `?board=<id>`; `?tracked=1` shows applied/hidden jobs |
| `/[jobid]` | `JobDetail` | Description, `ApplyPanel`, `AutoFill`, `ApplicationForm` |
| `/boards` | `BoardsPage` | Create, edit, reorder, delete boards. `?edit=<id>` opens an editor |
| `/profile` | `ProfilePage` | CV upload, review, save |
| `/applications` | `ApplicationsPage` | Tracker, tabs by status |
| `/memory` | `MemoryPage` | Remembered answers |

### `lib/`
- **`apollo-client.ts`**: `makeClient()`. The `jobs` field policy uses `keyArgs: ["filter"]`, so each filter has its own cached list, and appends pages when `after` is set. ⚠️ Without that, "load more" would mix results from different searches.
- **`filters.ts`**: `FeedFilters`, `boardToFilters`, `toGraphqlFilter`, `filtersToBoardInput`, `describeFilter`. Both converters rebuild plain objects because Apollo results carry `__typename`, which GraphQL rejects in input types.
- **`use-feed-filters.ts`**: the active board and its filter.
- **`use-application-actions.ts`**: save/hide/status/notes mutations. Hiding or saving evicts the job from every cached `jobs` list immediately, so the list doesn't jump back to page one.
- **`sanitize.ts`**: DOMPurify; links open in a new tab with `noopener noreferrer`. Browser-only, so it returns an empty string on the server.
- **`api.ts`**: `uploadCv` (plain `fetch` multipart POST).
- **`*-queries.ts`**: GraphQL documents per feature (`queries`, `profile`, `board`, `application`, `memory`, `form`, `apply-run`). Typed documents come from `gql/` (generated, gitignored).

### Components (what matters)
- **`BoardBar`**: All + boards as tabs with capped counts (loaded separately), the `+` menu (blank board or preset), and the active board's filter in words with an "Edit board" link. The `+` menu sits outside the scrolling tab strip so its dropdown isn't clipped.
- **`BoardEditor`**: the single editor for name and every filter, with a live "Shows: …" summary. Regions come from `regionOptions` (only places that exist in your data, with counts).
- **`JobList`**: cards with Save / Not interested, status badge, and timeline headers (Today, Yesterday, This week, Last week, Earlier) by first-seen date in the browser's timezone, added after mount to avoid hydration mismatches. "Load more" runs `fetchMore` in a transition so the list stays on screen.
- **`JobDetail`**: sanitizes the description only after mount (the server render and first client render must match).
- **`ApplyPanel`**: apply link (labelled by ATS), CV download and copy-buttons for your details, "I've applied"; after applying, a status select and notes.
- **`ApplicationForm`**: the Greenhouse questions with where each answer would come from; answer inline, optionally "Remember for future applications".
- **`AutoFill`**: starts a run, polls every 2 seconds while the run is active, shows the outcome list and the confirmation screenshot, refetches the job when status becomes `SUBMITTED`, and hints "start `make runner`" if a run stays queued over 8 seconds.
- **`profile/`**: `ProfilePage` (upload, extract, review), `ProfileForm` (all sections), `form-state.ts` (form ↔ API conversion, required-field check, skill categories kept in a side map because the skills field is plain text), `fields.tsx`.

---

## Conventions and Samples

### Conventions

1. **Services hold all DB logic and import nothing from GraphQL.** Resolvers are thin: get the profile, call the service inside `guard()`, return the result. Reusable from a CLI, a test or the runner.
2. **Services throw `ValidationError`** for user-facing problems. Plain `Error` is for "should be unreachable". Pagination throws `InvalidCursorError`, which the resolver turns into a `GraphQLError`.
3. **Validate before writing.** Normalize and validate input first (`lib/validate.ts`), check business rules, then write. Never interleave.
4. **Multi-row writes use `db.transaction`.** Replace-the-list writers take a transaction handle.
5. **Partial update semantics:** `undefined` = unchanged, `null` = clear. Lists replace wholesale.
6. **Mutations return the updated entity** (or the whole `Profile` for profile-related ones), so Apollo's normalized cache updates without refetching.
7. **DB values are lowercase text; GraphQL enums are uppercase and mapped in Pothos** (`{ value: "remote" }`), so there is no casing mismatch to maintain by hand.
8. **Never guess.** Missing data stays null/blank; a doubtful match leaves the field empty. This applies to extraction, regions, answers and the runner.
9. **Personal data stays out of public tables.** Anything about the user hangs off `profile_id` and is never part of `jobs`.
10. **Generated files are never edited by hand:** `schema.graphql`, `apps/web/lib/gql/`, `packages/db/drizzle/*.sql`.
11. **One query for the list, a separate one for counts.** Slow computed fields (board counts) are requested in their own query so they never block the UI.

### Sample: adding a board source (Python)

```python
# pipeline/jobhunter/sources/example.py
from datetime import datetime
from ..models import RawJob
from ..normalize import infer_remote_type
from .base import BoardSource


class ExampleSource(BoardSource):
    name = "example"
    params = {}

    def url(self, slug: str) -> str:
        return f"https://example.com/api/boards/{slug}/jobs"  # placeholder endpoint

    def parse(self, slug: str, data) -> list[RawJob]:
        jobs = []
        for j in data.get("jobs", []):
            location = j.get("location")
            jobs.append(
                RawJob(
                    source=self.name,
                    source_id=f"{slug}:{j['id']}",       # stable, unique per source
                    url=j["url"],
                    apply_url=j.get("apply_url") or j["url"],
                    title=j["title"],
                    company_name=slug,
                    location=location,
                    remote_type=infer_remote_type(location, j["title"]),
                    description=j.get("description"),
                    posted_at=None,
                    raw=j,                                # keep the raw payload
                )
            )
        return jobs
```

Then register it in `sources/__init__.py` (`build_source` and `SOURCE_NAMES`), add its slugs to `sources.toml`, and add it to the `BOARDS` list in `cli.py` if it should run in `make scrape-all`. If it is a new ATS, teach `harvest.py` its URL pattern and `BOARD_SOURCES` in `db.py` its per-board closing behaviour. Add the source name to `SOURCE_OPTIONS` in `board-editor.tsx` (it is a hard-coded list).

### Sample: adding a filter end to end
A filter touches the same seven places. Do all of them, or it silently won't save or apply:
1. `jobs.filters.ts`: the field on `JobFilterInput` and its SQL in `buildConditions`.
2. `jobs.types.ts`: the field on the `JobFilter` input type.
3. `boards.filter.ts`: `BoardFilter`, `BoardFilterInputShape`, the permissive `READ` schema and `normalizeFilter`.
4. `boards.types.ts`: the field on `BoardFilter` (output) and `BoardFilterInput`.
5. `make schema`.
6. `apps/web/lib/board-queries.ts`: add the field to `BoardFilterFields`.
7. `apps/web/lib/filters.ts` (`FeedFilters`, `EMPTY_FILTERS`, the three converters, `describeFilter`) and `board-editor.tsx`.

### Sample: adding an API module
Copy `modules/memory/` (the smallest complete example): `*.service.ts` (DB logic), `*.types.ts` (object type, enums), `*.queries.ts`, `*.mutations.ts`, `index.ts`; add one import to `src/schema.ts`; run `make schema`; add `apps/web/lib/<feature>-queries.ts` and register it in `codegen.ts`. A new table goes in `packages/db/src/schema/` with an export line in `index.ts`, then `generate` and `migrate`.

### Where to look when X breaks

| Symptom | Start at |
|---|---|
| No jobs / stale jobs | `make scrape-all` output; `scrape_runs`; `companies.enabled/fail_count` |
| A board's jobs vanished | `close_stale` only closes boards that returned at least one job; check `last_error` |
| Region board is empty | `make enrich` report; `shared/regions.json`; remember region boards exclude unclassified jobs |
| Query returns null for a non-null field | Pothos `defaultFieldNullability: false`; a service returned null |
| Filter saved but not applied | The seven-place checklist above |
| Upload returns 403 | Opening the app from a different origin than `WEB_ORIGIN` (`127.0.0.1` vs `localhost`) |
| "Gemini model not found" | Model retired for new users; list models for your key and update `GEMINI_MODEL` (read the server log for Google's exact reason) |
| Auto-fill stays "Waiting for the runner" | `make runner` isn't running |
| A field wasn't filled | The run's outcome list; re-run with `RUNNER_INSPECT=1` and read the controls in the run log |
| Web types missing | Run `make schema`, then restart `make web` (codegen runs on dev/typecheck) |

---

## Appendix: Cross-Cutting Concepts

### Single user, localhost only
There are no accounts. `getOrCreateProfile` returns the one profile, and every service calls it. The API listens on `127.0.0.1`, the upload route checks the browser origin, and nothing else is authenticated. This is deliberate for a self-hosted tool. A hosted version would need accounts, a per-request profile in the GraphQL context instead of the singleton, ownership checks on every board/document/draft/run id, and per-user limits. `boards`, `applications` and the rest already carry `profile_id`, which is the hook for that.

### Privacy model
- Public data (jobs, companies, regions, job forms) vs personal data (everything keyed by `profile_id`) are separate tables and separate code paths.
- The CV and profile reach a third party only when you upload a CV (Gemini). The UI says so before the first extraction.
- No secret is stored in the database. Keys live in `.env`.
- Third-party HTML (job descriptions) is sanitized with DOMPurify before rendering.

### "Never guess"
The same rule appears in four places: region classification returns nothing when unsure, extraction returns null, memory only applies on an exact normalized question match (and exact dropdown option match), and the runner leaves unresolved fields blank and outlined. A wrong answer sent under the user's name is worse than an empty field.

### The user submits
Auto-fill is assisted, not automated submission. ATS submission APIs belong to employers, and the submit step runs a reCAPTCHA in the live page. The runner stops at "ready for you", and proof of submission is a screenshot of the confirmation page the user reached themselves.

### Status/enum catalogue (DB value → GraphQL)

| Concept | Values |
|---|---|
| `jobs.remote_type` | `remote, hybrid, onsite, unknown` → `REMOTE, HYBRID, ONSITE, UNKNOWN` |
| `applications.status` | `saved, applied, interviewing, offer, rejected, hidden` |
| `profile_drafts.status` | `pending, ready, failed, confirmed, discarded` (text on the API) |
| `documents.kind` | `cv, cover_letter, other` |
| `answers.answer_type` | `text, yesno` → `TEXT, YES_NO` |
| Form question kind | `text, textarea, select, multiselect, unsupported` |
| Answer resolution | `profile, job_answer, memory, none` |
| `apply_runs.status` | `queued, opening, filling, needs_you, submitted, closed, failed, abandoned` |
| Run outcome | `filled, check, left, failed` |
| `jobs.status` (unused) | `verified, likely, unverified, ghost` |

### Ports

| Service | Port |
|---|---|
| Postgres (default; your `.env` may use 5433) | 5432 |
| API (GraphQL at `/graphql`) | 4000 |
| Web | 3000 |

---

## Known Gaps and Flags

Listed by how much they matter. Confidence note: this list comes from reading the code as it was written; items marked "unverified" have not been exercised.

### High
1. **No automated tests or CI.** The pure logic is the best place to start: `validate.ts`, `pagination.ts`, `computeYears`, `normalizeFilter`/`parseFilter`, `buildConditions`, the form parser and resolver in `forms`, the Python region classifier (there is an inline sanity check in the history but no test file), `harvest` regexes and `close_stale`.
2. **The runner has never run against a real Greenhouse form.** Its selectors follow the documented behaviour of the hosted React form (ARIA comboboxes, hidden file input, debounced email validation). Expect adjustments; `RUNNER_INSPECT=1` exists for that. Phone and location are deliberately always flagged for a manual check.
3. **Unauthenticated API.** Safe only because it listens on localhost. The document download and screenshot routes are also unauthenticated.
4. **Python SQL is hand-mirrored from the Drizzle schema.** `db.py` names columns directly. A migration that renames one breaks the pipeline with no compile-time or test-time signal.

### Medium
5. **Ghost-job detection isn't built.** `jobs.status` and `jobs.score` exist and are never written; every job is "unverified". The feed can show ghost or stale listings. Lifecycle data (`first_seen_at`, `last_seen_at`, `closed_at`) is being collected for it.
6. **`jobs.company_id` is never set.** Company data is reached by a join on `(source, slug)`. Lever and Ashby jobs show the slug as the company name (for example "turquoise-health").
7. **Stack and title filters are regex scans over HTML descriptions.** Fine at about 8k jobs; counts are capped at 500 and the first page can be slow with many keywords. A precomputed tag column or `tsvector` is the fix.
8. **Duplicates across sources.** The same role can appear on LinkedIn-style aggregators and the company board; `dedupe_key` is stored but no query uses it.
9. **Region classification limits.** It reads only free-text locations. Ambiguities remain (`Georgia` always reads as the US state, `Valencia` and `SEA` are unclassified, `Remote, DE` with no city reads as Delaware). No containment: Germany is not matched by an EU board. Many board jobs state no region at all (plain "Remote", "Hybrid"), and those are excluded from any board with a regions filter. "Eligible for me" is not built.
10. **Run bookkeeping races.** `startApply` checks for an active run and then inserts, with no unique constraint, so two quick clicks could queue two runs. The runner assumes a single process. Watching lives in the runner's memory, so a runner restart abandons in-flight runs (their windows close with it).
11. **Submission detection is a heuristic** (form gone plus a confirmation phrase or URL). Employers with custom confirmation text can be missed (the user can mark applied by hand), and closing the window within about a second of submitting can record "closed" instead of "submitted".
12. **Memory only grows by explicit action today.** The planned "Remember these?" capture of answers typed into blank fields isn't built. Matching is exact on normalized wording, so reworded questions (`How did you hear about us?` vs `Where did you find this role?`) don't match.
13. **Greenhouse only.** Forms, auto-fill and the question list exist only for Greenhouse jobs. Lever, Ashby and aggregator jobs get the plain apply link. `apply_method` (form/email/external) is not classified yet.

### Low
14. **Date display mixes UTC and local time.** Several places show `toISOString().slice(0, 10)` (UTC), while timeline headers use the browser's timezone, so they can disagree near midnight.
15. **Hard-coded and startup-loaded lists:** `SOURCE_OPTIONS` in `board-editor.tsx`; board presets are read once at API startup.
16. **Legacy columns:** `answers.key` and `answers.position` are unused since the Memory redesign.
17. **Model retirement:** Gemini model names change; the model is config-only, and a retired name produces a 404 that the UI reports generically (the server log has Google's exact message).
18. **Upload buffering:** the upload handler holds the whole request body in memory (up to about 10.25 MB).
19. **`scrape_runs` is write-only:** nothing reads it. There is no pipeline status page.
20. **Profile edge cases:** `years_experience` is computed only on confirm (manual `saveProfile` can set any value); skill categories survive the plain-text skills field through a side map.
21. **Hacker News parsing is best effort** (see Pipeline).
22. **Docs drift:** `docs/PRD.md` sections 6 and 14 track the build; its roadmap table (section 7) lags. Template leftovers (`AGENTS.md`, `CLAUDE.md`, most of `packages/ui`) are unused.
