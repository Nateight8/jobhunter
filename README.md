# jobhunter

Open-source, self-hosted job hunting engine. Scrapes LinkedIn, Indeed, company ATS boards and remote boards, filters out ghost listings, and surfaces verified jobs matching your stack. Runs locally with Postgres.

> **Status:** early development. Nothing works yet.

## Planned architecture

- `pipeline/`: Python. Scrapes, normalizes, dedupes, verifies and scores jobs, then writes to Postgres.
- `apps/api`: Node/TS. Reads Postgres and serves the REST API, saved filters and notifications.
- `apps/web`: Next.js + shadcn/ui. The review client.
- `packages/`: shared JS configs and UI components.
- `db/migrations/`: plain SQL migrations, shared by everything.

Postgres is the only boundary between the Python and Node sides.

## Roadmap

1. Scraper ingestion into Postgres (ATS boards first, then LinkedIn/Indeed via JobSpy)
2. Company resolution and ghost-job verification
3. API and web client with filters
4. Notifications and CV generation

## License

MIT
