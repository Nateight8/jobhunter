import os
from pathlib import Path

import psycopg
from dotenv import load_dotenv
from psycopg.types.json import Jsonb

from .models import RawJob
from .normalize import dedupe_key

load_dotenv(Path(__file__).resolve().parents[2] / ".env")

UPSERT = """
INSERT INTO jobs (
    source, source_id, url, apply_url, title, company_name, location,
    remote_type, description, posted_at, dedupe_key, raw
) VALUES (
    %(source)s, %(source_id)s, %(url)s, %(apply_url)s, %(title)s, %(company_name)s,
    %(location)s, %(remote_type)s, %(description)s, %(posted_at)s, %(dedupe_key)s, %(raw)s
)
ON CONFLICT (source, source_id) DO UPDATE SET
    last_seen_at = now(),
    closed_at = NULL,
    url = EXCLUDED.url,
    apply_url = EXCLUDED.apply_url,
    title = EXCLUDED.title,
    company_name = EXCLUDED.company_name,
    location = EXCLUDED.location,
    remote_type = EXCLUDED.remote_type,
    description = EXCLUDED.description,
    posted_at = COALESCE(EXCLUDED.posted_at, jobs.posted_at),
    dedupe_key = EXCLUDED.dedupe_key,
    raw = EXCLUDED.raw
RETURNING (xmax = 0) AS inserted
"""


def connect() -> psycopg.Connection:
    url = os.environ.get("DATABASE_URL")
    if not url:
        raise SystemExit("DATABASE_URL is not set (check the root .env)")
    return psycopg.connect(url, autocommit=True)


def start_run(conn: psycopg.Connection, source: str) -> str:
    row = conn.execute(
        "INSERT INTO scrape_runs (source) VALUES (%s) RETURNING id", (source,)
    ).fetchone()
    return row[0]


def finish_run(
    conn: psycopg.Connection, run_id: str, seen: int, new: int, error: str | None
) -> None:
    conn.execute(
        "UPDATE scrape_runs SET finished_at = now(), jobs_seen = %s, jobs_new = %s, error = %s WHERE id = %s",
        (seen, new, error, run_id),
    )


def upsert_jobs(conn: psycopg.Connection, jobs: list[RawJob]) -> tuple[int, int]:
    new = 0
    with conn.cursor() as cur:
        for job in jobs:
            params = job.model_dump(exclude={"raw"})
            params["raw"] = Jsonb(job.raw)
            params["dedupe_key"] = dedupe_key(job.company_name, job.title, job.location)
            cur.execute(UPSERT, params)
            if cur.fetchone()[0]:
                new += 1
    return len(jobs), new


def ats_slugs(conn: psycopg.Connection, ats_type: str) -> list[str]:
    rows = conn.execute(
        "SELECT ats_slug FROM companies WHERE ats_type = %s AND ats_slug IS NOT NULL",
        (ats_type,),
    ).fetchall()
    return [r[0] for r in rows]


BOARD_SOURCES = {"greenhouse", "lever", "ashby"}


def db_now(conn: psycopg.Connection):
    return conn.execute("SELECT now()").fetchone()[0]


def close_stale(
    conn: psycopg.Connection, source: str, jobs: list[RawJob], run_started
) -> int:
    """Mark jobs not seen in this run as closed, only for feeds that responded.

    Board sources are handled per board, so a failed or empty fetch for one
    board never closes that board's jobs. Single-feed sources only close
    when the feed returned at least one job.
    """
    if not jobs:
        return 0
    closed = 0
    with conn.cursor() as cur:
        if source in BOARD_SOURCES:
            boards = {j.source_id.split(":")[0] for j in jobs}
            for board in boards:
                cur.execute(
                    """
                    UPDATE jobs SET closed_at = now()
                    WHERE source = %s AND split_part(source_id, ':', 1) = %s
                      AND closed_at IS NULL AND last_seen_at < %s
                    """,
                    (source, board, run_started),
                )
                closed += cur.rowcount
        else:
            cur.execute(
                """
                UPDATE jobs SET closed_at = now()
                WHERE source = %s AND closed_at IS NULL AND last_seen_at < %s
                """,
                (source, run_started),
            )
            closed += cur.rowcount
    return closed


def disabled_slugs(conn: psycopg.Connection, ats_type: str) -> list[str]:
    rows = conn.execute(
        "SELECT ats_slug FROM companies WHERE ats_type = %s AND NOT enabled", (ats_type,)
    ).fetchall()
    return [r[0] for r in rows]


MAX_FAILS = 5  # consecutive failed runs before a board is disabled


def record_board_results(conn: psycopg.Connection, ats_type: str, results: dict) -> int:
    """Save per-board outcome. Returns how many boards were newly disabled."""
    # If nothing succeeded, the network is probably down: don't blame the boards.
    if not any(err is None for _, err in results.values()):
        return 0
    disabled = 0
    with conn.cursor() as cur:
        for slug, (count, error) in results.items():
            if error is None:
                cur.execute(
                    """
                    INSERT INTO companies (name, ats_type, ats_slug, open_jobs, last_scraped_at)
                    VALUES (%s, %s, %s, %s, now())
                    ON CONFLICT (ats_type, ats_slug) DO UPDATE SET
                        open_jobs = EXCLUDED.open_jobs, last_scraped_at = now(),
                        fail_count = 0, last_error = NULL
                    """,
                    (slug, ats_type, slug, count),
                )
            else:
                cur.execute(
                    """
                    INSERT INTO companies (name, ats_type, ats_slug, fail_count, last_error)
                    VALUES (%s, %s, %s, 1, %s)
                    ON CONFLICT (ats_type, ats_slug) DO UPDATE SET
                        fail_count = companies.fail_count + 1, last_error = EXCLUDED.last_error,
                        enabled = companies.enabled AND companies.fail_count + 1 < %s
                    RETURNING NOT enabled
                    """,
                    (slug, ats_type, slug, error, MAX_FAILS),
                )
                disabled += bool(cur.fetchone()[0])
    return disabled
