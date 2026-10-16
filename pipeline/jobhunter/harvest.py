import re

import psycopg

PATTERNS = {
    "greenhouse": re.compile(
        r"(?:boards|job-boards)(?:\.eu)?\.greenhouse\.io/(?:embed/job_app\?for=)?([A-Za-z0-9_-]+)"
    ),
    "lever": re.compile(r"jobs(?:\.eu)?\.lever\.co/([A-Za-z0-9_.-]+)"),
    "ashby": re.compile(r"jobs\.ashbyhq\.com/([A-Za-z0-9_.-]+)"),
}
IGNORE = {"embed", "jobs", "api", "v1"}

INSERT = """
INSERT INTO companies (name, ats_type, ats_slug)
VALUES (%s, %s, %s)
ON CONFLICT (ats_type, ats_slug) DO NOTHING
"""


def extract(text: str | None) -> set[tuple[str, str]]:
    found: set[tuple[str, str]] = set()
    if not text:
        return found
    for ats, pattern in PATTERNS.items():
        for m in pattern.finditer(text):
            slug = m.group(1)
            if slug.lower() in IGNORE:
                continue
            found.add((ats, slug.lower() if ats == "greenhouse" else slug))
    return found


def harvest(conn: psycopg.Connection) -> dict[str, int]:
    found: set[tuple[str, str]] = set()
    for url, apply_url, description in conn.execute(
        "SELECT url, apply_url, description FROM jobs"
    ):
        for text in (url, apply_url, description):
            found |= extract(text)

    added = {"greenhouse": 0, "lever": 0, "ashby": 0}
    with conn.cursor() as cur:
        for ats, slug in sorted(found):
            cur.execute(INSERT, (slug, ats, slug))
            added[ats] += cur.rowcount
    return added
