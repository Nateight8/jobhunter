# jobhunter: Product Requirements

**Version:** 2.0 (supersedes the v1.1 draft)
**Status:** living document, edit as decisions change
**Repo:** https://github.com/Nateight8/jobhunter

## 1. Vision

An open-source, local-first tool that finds **real** jobs that fit you, and makes applying to them as seamless as safely possible.

Two promises:

1. **Legit jobs only.** Scrape widely, then filter out ghost listings and jobs you can't actually take (region limits).
2. **Seamless applying.** Set up your profile once. Every application after that starts from it: CV, answers and cover letter are ready, and you review before anything is sent in your name.

Audience: job hunters (first user: a developer in Nigeria applying to remote roles), self-hosted on their own machine.

## 2. Principles

- **Scraping only ingests.** The pipeline writes jobs to Postgres. Filtering is a query. Scoring and classification (eligibility, ghost score, apply method) are a separate `enrich` step that can be re-run without re-scraping.
- **Postgres is the only boundary** between the Python pipeline and the Node API.
- **Personal data stays local.** Profile, applications and documents never go to a hosted service. A future hosted scraper only serves public job data.
- **You press submit.** Nothing is sent in the user's name without a review step.
- **Never fabricate.** AI may reword and reorder real profile entries. It may not invent skills, employers, dates or answers.
- **No secrets in the database.** Keys live in `.env`.
- **Keep it simple.** Prefer the smaller solution; add machinery when a real need appears.

## 3. Current state (built)

| Area            | Status                                                                                                                                                                                        |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Python pipeline | Sources: Greenhouse, Lever, Ashby, RemoteOK, Remotive, Hacker News "Who is hiring". Slug harvester, stale-job closing, board health (`enabled`, `fail_count`, `open_jobs`), `make scrape-all` |
| Database        | Drizzle schema in `packages/db` (`companies`, `jobs`, `scrape_runs`), Postgres in Docker                                                                                                      |
| API             | `apps/api`: GraphQL Yoga + Pothos, feature modules, cursor-paginated `jobs` query with filters (search, stack, remote type, source, startup size), `job(id)`, generated `schema.graphql`      |
| Web             | `apps/web`: Next.js + Apollo Client (Next.js integration), feed with URL-driven filters and a detail panel                                                                                    |

## 4. Architecture

```
Python pipeline  ──writes──▶  PostgreSQL  ◀──reads/writes──  GraphQL API  ◀──  Next.js web
 (scrape, enrich)             (packages/db schema)           (apps/api)         (apps/web)
                                                                  ▲
                                                                  └──  Chrome extension (later)
```

- **`pipeline/`** (Python, uv): scrape, normalize, harvest, `enrich`. Writes `jobs` and `companies`.
- **`apps/api`** (Node, TypeScript): all application state: profile, applications, documents. Calls the AI provider. Compiles PDFs.
- **`apps/web`**: feed, profile, tracker, tailoring workbench.
- **`packages/db`**: Drizzle schema and migrations, the source of truth for tables.
- The API binds to `localhost` only.

## 5. How applying works

Jobs differ in how you apply, and that is stored per job, not guessed in the UI.

### 5.1 Apply method (on `jobs`, computed by `enrich`)

| Field          | Values                                                                                                                      |
| -------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `apply_method` | `form` (employer ATS form), `email` (contact address in posting), `external` (other site or aggregator redirect), `unknown` |
| `apply_ats`    | `greenhouse`, `lever`, `ashby`, `workday`, `smartrecruiters`, `workable`, `linkedin`, ... or null                           |
| `apply_email`  | address found in the posting, only for `email`                                                                              |

Sources: ATS boards give `form` with a known ATS. HN postings are checked for ATS links, then emails, then plain links. RemoteOK and Remotive are `external` until their redirects are followed.

### 5.2 Levels of automation

1. **Assisted apply (v1).** The app prepares CV, profile fields, answers and cover letter, opens the employer's form, and the user submits and marks it applied. The Apply button states what it does ("Apply on Greenhouse", "Email application").
2. **Autofill extension (later).** A Chrome extension fetches the profile from the local API and fills standard fields on supported ATS forms. AI-suggested answers to custom questions appear beside the field for the user to accept. The user reviews and presses submit.
3. **Unattended submission (not planned).** Possibly an opt-in for Greenhouse, Lever and Ashby forms only, much later. ATS submission APIs belong to employers, so this means driving the browser, which is fragile and risky.

## 6. Feature: Profile (next)

The profile is the foundation for tailoring, answers, autofill and eligibility. Without it nothing after it can be seamless.

### 6.1 Goals

- Enter facts once, reuse them everywhere (forms, CVs, cover letters, emails).
- Make every AI-written sentence traceable to a profile entry.
- Capture eligibility facts so the feed can hide jobs the user can't take.
- Show a clear "apply-ready" checklist.

### 6.2 Scope (v1)

Single user, no login, one profile. Manual entry through forms. A CV file can be uploaded and stored. Importing a CV into structured fields comes later and needs AI.

### 6.3 Data

**Identity and contact**: full name, preferred name, email, phone, city, country, timezone.

**Links**: LinkedIn, GitHub, portfolio, other (label + URL).

**Eligibility**

- country of residence
- regions authorized to work in (list)
- needs visa sponsorship (yes/no)
- willing to relocate (yes/no, regions)
- notice period, earliest start date

**Search preferences** (pre-fill the feed filters)

- target roles, stack keywords, seniority
- work modes (remote, hybrid, onsite), regions open to
- salary expectation (minimum, currency, period)
- company size preference (startup)

**Experience** (ordered): company, title, location, start, end or current, bullets (ordered list), technologies.

**Education**: school, degree, field, start, end.

**Projects**: name, URL, description, technologies, bullets.

**Skills**: name, optional category.

**Answers bank**: reusable answers to questions that recur in forms. Each has a key, the question wording, and the answer. Pre-seeded keys, left empty for the user to fill:

| Key                     | Example question                         |
| ----------------------- | ---------------------------------------- |
| `work_authorization`    | Are you legally authorized to work in X? |
| `sponsorship`           | Will you require visa sponsorship?       |
| `notice_period`         | When can you start?                      |
| `salary_expectation`    | Expected compensation?                   |
| `relocation`            | Are you willing to relocate?             |
| `referral_source`       | How did you hear about us?               |
| `why_remote` / `why_us` | free text, tailored per job later        |

**Documents**: master CV (PDF, one default), cover letter base text, other files. Stored on disk under `data/documents/` (gitignored). The database holds only metadata and path.

**Writing preferences**: tone (formal, friendly, concise), cover-letter style notes.

### 6.4 Readiness

`readiness` returns whether the profile can drive an application, and what is missing. Apply-ready requires: name, email, phone, country, a default CV file, and answers for `work_authorization` and `sponsorship`. Missing items are listed in the UI.

### 6.5 Privacy rules

- Profile data is never stored in `jobs` or any table the pipeline or a hosted service touches.
- Profile data is sent to an AI provider only when the user triggers an AI action and has configured a key. The UI says so before the first use.
- No API key, token or password is stored in the profile.
- Documents are not exposed through GraphQL as content, only downloaded from a local, authenticated-by-localhost route.

### 6.6 API (GraphQL, `apps/api/src/modules/profile/`)

- `Query.profile`: the profile with all sections and `readiness`.
- `Mutation.saveProfile(input)`: identity, links, eligibility, preferences, writing preferences.
- `Mutation` per list section: `upsertExperience`, `deleteExperience`, same for education, projects, skills, answers. Reordering for experience and bullets.
- `Mutation.uploadDocument(kind, file)`, `setDefaultDocument(id)`, `deleteDocument(id)`. Uses multipart upload supported by Yoga.

### 6.7 Web

A `/profile` page with sections (Basics, Eligibility, Preferences, Experience, Education, Projects, Skills, Answers, Documents), a readiness checklist at the top, and autosave per section.

### 6.8 Out of scope for v1

CV import by AI, multiple profiles, login, encrypting stored data, editing PDFs.

## 7. Roadmap

| Phase | Deliverable                                                                                                                                                                |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0     | Ingestion, API, feed (done)                                                                                                                                                |
| 1     | **Profile** (this document, section 6)                                                                                                                                     |
| 2     | `enrich` step for `apply_method` / `apply_ats` / `apply_email`; applications tracker (saved, preparing, applied, interviewing, offer, rejected, hidden)                    |
| 3     | Eligibility and ghost-job enrichment, using profile eligibility facts; feed defaults to eligible, verified jobs                                                            |
| 4     | Tailoring workbench: AI-tailored CV from structured profile, deterministic ATS keyword score, cover letter, PDF export. AI provider key in `.env`, model name configurable |
| 5     | Autofill browser extension (Greenhouse, Lever, Ashby first)                                                                                                                |
| 6     | Integrations: GitHub project context (user picks repos), email apply and follow-ups over SMTP                                                                              |
| 7     | Optional hosted scraper that local instances sync public job data from                                                                                                     |

## 8. Data model additions

New tables in `packages/db/src/schema/`, one file per domain:

- **profile**: `profiles`, `profile_links`, `experiences`, `education`, `projects`, `skills`, `answers`, `documents`
- **applications**: `applications` (job_id, status, mode, applied_at, notes), `application_revisions` (application_id, kind, content, created_at) for tailored CV and cover letter versions
- **saved filters**: `saved_filters` (name, query)
- **jobs** gains: `apply_method`, `apply_ats`, `apply_email`, `eligibility`, `updated_at`

Personal state lives in separate tables keyed by `job_id`, never on `jobs`, which stays public data.

## 9. Non-functional requirements

- **Local-first:** works offline apart from scraping and AI calls. One `docker compose up` plus `make` targets to run.
- **Idempotent pipeline:** `make scrape-all` can be run any time without duplicating rows.
- **Politeness:** respect source rate limits and attribution (RemoteOK and Remotive require credit and links back).
- **Feed performance:** the filtered `jobs` query returns in under a second at 50k rows.
- **Safety:** third-party HTML is always sanitized before rendering. No secrets in the database. The API listens on localhost only.
- **AI honesty:** generated documents are checked against profile entries. "Missing keywords" are suggestions for the user to confirm, never auto-inserted.

## 10. Non-goals

- Unattended auto-submission in v1.
- Scraping LinkedIn while logged in.
- Multi-user accounts and hosted profiles.
- Storing keys in Postgres.
- Failover across several AI providers (one provider behind a small interface is enough).

## 11. Decisions log

| Decision          | Choice                                                                   |
| ----------------- | ------------------------------------------------------------------------ |
| Pipeline language | Python, Postgres as the only boundary                                    |
| Schema owner      | Drizzle (`packages/db`), Python writes via raw SQL                       |
| API               | GraphQL Yoga + Pothos (code-first), generated `schema.graphql` committed |
| Web client        | Apollo Client with the Next.js integration                               |
| Scraping          | CLI only; web app is read-only for scraping                              |
| Applying          | Assisted apply in v1; autofill extension later                           |
| Apply method      | Stored per job, computed in `enrich`                                     |
| Credentials       | `.env`, integrations deferred                                            |

## 12. Open questions

- CV import: parse a PDF into structured fields with AI, with the user confirming each entry?
- PDF generation: headless Chromium (best output, heavy install) or a lighter library?
- Hosted scraper: who pays, and what redistribution terms apply to each source?
- Extension distribution: Chrome Web Store, or load unpacked for self-hosters?

## 13. Changes from v1.1

- Fast Apply "submission worker" replaced by assisted apply, because ATS submission APIs are employer-only.
- Application state moved off `jobs` into `applications`, because `jobs` is public data written by the pipeline.
- API keys and SMTP passwords no longer stored in Postgres.
- Profile is structured (experience, projects, skills) instead of one Markdown blob, so output can be checked against it.
- ATS score is computed deterministically, not by asking an LLM for a number.
- Added the missing core goals: ghost filtering, eligibility and startup focus.
- Integrations (AI, GitHub, SMTP) deferred to a later phase.

## 14. Apply automation (decided)

- The app never presses submit. A visible browser window on the user's machine fills the employer's form and stops; the user reviews and submits, so they know it went through.
- Answers used by the runner, in order: the job's accepted answers, then memory, then blank (left empty and highlighted). Nothing is guessed.
- AI suggestions are only proposals. They become planned answers for a job only when the user accepts them.
- "Authorized to work in X" is answered per job (it depends on the job's country), not stored in memory.
- Proof of submission: after the user submits, the runner captures the confirmation page and the answers used. If the page isn't recognized, the user confirms manually.
- Order: answers bank, per-job answers and read-only view, Greenhouse runner, Lever and Ashby, then the AI assistant writing suggested answers.

### 14.1 Memory

- Memory starts empty. The user never has to fill it in.
- Entries are only created with the user's approval, from two places: answers the user typed into a form (captured by the runner, then offered with "Remember these?"), and AI suggestions the user accepted for a job (with an "Add to memory?" choice).
- Remembering is a separate choice from answering. Job-specific answers (why this company) default to not remembered; factual ones (notice period, salary, sponsorship) default to offering to remember.
- Matching uses normalized question text at first, and semantic matching once the AI assistant exists. When a match is doubtful the field stays blank: a wrong answer is worse than an empty one.
- The Memory page lists every entry with its last-updated date, and lets the user edit, delete or add entries by hand.
- Stored in the existing `answers` table, exposed as `MemoryEntry` in the API.

### 14.2 Application forms and per-job answers

- For Greenhouse jobs, the API fetches the posting's application form on demand (public Job Board API with `questions=true`), caches it for 12 hours, and shows it on the job page. The pipeline does not fetch it.
- Each custom question shows where its answer would come from: the user's answer for this job, the profile (LinkedIn, GitHub, portfolio, location), memory, or nothing (left blank).
- Per-job answers are stored in `job_answers` with a source (you, memory, suggested) and a status (accepted, suggested). Only accepted answers are used. The AI assistant will add suggested rows, and the user accepts them.
- A remembered answer is only used for a dropdown when it exactly matches one of the options. Optional demographic and EEOC questions are never filled.
- Other ATSs show no questions until their adapters exist.

### 14.2 Application forms and per-job answers

- For Greenhouse jobs, the API fetches the posting's application form on demand (public Job Board API with `questions=true`), caches it for 12 hours, and shows it on the job page. The pipeline does not fetch it.
- Each custom question shows where its answer would come from: the user's answer for this job, the profile (LinkedIn, GitHub, portfolio, location), memory, or nothing (left blank).
- Per-job answers are stored in `job_answers` with a source (you, memory, suggested) and a status (accepted, suggested). Only accepted answers are used. The AI assistant will add suggested rows, and the user accepts them.
- A remembered answer is only used for a dropdown when it exactly matches one of the options. Optional demographic and EEOC questions are never filled.
- Other ATSs show no questions until their adapters exist.

### 14.2 Application forms and per-job answers

- For Greenhouse jobs, the API fetches the posting's application form on demand (public Job Board API with `questions=true`), caches it for 12 hours, and shows it on the job page. The pipeline does not fetch it.
- Each custom question shows where its answer would come from: the user's answer for this job, the profile (LinkedIn, GitHub, portfolio, location), memory, or nothing (left blank).
- Per-job answers are stored in `job_answers` with a source (you, memory, suggested) and a status (accepted, suggested). Only accepted answers are used. The AI assistant will add suggested rows, and the user accepts them.
- A remembered answer is only used for a dropdown when it exactly matches one of the options. Optional demographic and EEOC questions are never filled.
- Other ATSs show no questions until their adapters exist.

### 14.2 Application forms and per-job answers

- For Greenhouse jobs, the API fetches the posting's application form on demand (public Job Board API with `questions=true`), caches it for 12 hours, and shows it on the job page. The pipeline does not fetch it.
- Each custom question shows where its answer would come from: the user's answer for this job, the profile (LinkedIn, GitHub, portfolio, location), memory, or nothing (left blank).
- Per-job answers are stored in `job_answers` with a source (you, memory, suggested) and a status (accepted, suggested). Only accepted answers are used. The AI assistant will add suggested rows, and the user accepts them.
- A remembered answer is only used for a dropdown when it exactly matches one of the options. Optional demographic and EEOC questions are never filled.
- Other ATSs show no questions until their adapters exist.

### 14.3 The runner (decided and built)

- A separate process (`make runner`) polls the `apply_runs` table. The API only queues runs and reports status.
- It opens a visible Chrome window with a persistent profile on the user's machine and fills the Greenhouse form: name, email, phone (flagged to check), the default CV, every custom question that resolves to an answer, and location. Anything without an answer is left blank and highlighted. Optional demographic questions, the education block and the cover letter are always left for the user.
- It never presses Submit and never solves CAPTCHAs or emailed security codes; those are the user's to complete in the window.
- It watches for the submission (the form disappears and a confirmation page appears), saves a screenshot of the confirmation as proof, and marks the job as applied.
- Selectors follow the documented behavior of Greenhouse's hosted form and are expected to need adjustments; `RUNNER_INSPECT=1` logs the form controls to help.
- Next: capture what the user typed into blank fields and offer "Remember these?".
