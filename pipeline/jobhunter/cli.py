import argparse
import asyncio
import logging
import tomllib
from pathlib import Path

from . import db
from .sources import SOURCE_NAMES, build_source


def main() -> None:
    parser = argparse.ArgumentParser(prog="jobhunter")
    sub = parser.add_subparsers(dest="cmd", required=True)
    scrape = sub.add_parser("scrape", help="Run a source and store jobs")
    scrape.add_argument("source", choices=SOURCE_NAMES)
    scrape.add_argument("--dry-run", action="store_true", help="Fetch only, no DB writes")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    config = tomllib.loads((Path(__file__).resolve().parents[1] / "sources.toml").read_text())
    source = build_source(args.source, config)

    if args.dry_run:
        jobs = asyncio.run(source.fetch())
        print(f"{len(jobs)} jobs fetched (dry run)")
        for j in jobs[:5]:
            print(f"- {j.company_name} | {j.title} | {j.location} | {j.remote_type}")
        return

    with db.connect() as conn:
        run_id = db.start_run(conn, source.name)
        try:
            jobs = asyncio.run(source.fetch())
            seen, new = db.upsert_jobs(conn, jobs)
            db.finish_run(conn, run_id, seen, new, None)
            print(f"{source.name}: {seen} seen, {new} new")
        except Exception as e:
            db.finish_run(conn, run_id, 0, 0, str(e))
            raise
