import argparse
import asyncio
import logging
import sys
import tomllib
from pathlib import Path

from . import db
from .enrich import enrich
from .harvest import harvest
from .sources import SOURCE_NAMES, BoardSource, build_source

DISCOVERY = ["remotive", "remoteok", "hackernews"]
BOARDS = ["greenhouse", "lever", "ashby"]


def load_config() -> dict:
    return tomllib.loads((Path(__file__).resolve().parents[1] / "sources.toml").read_text())


def run_source(name: str, config: dict, dry_run: bool = False) -> str:
    # Built here, not earlier, so board sources see slugs harvested moments ago
    source = build_source(name, config)

    if dry_run:
        jobs = asyncio.run(source.fetch())
        lines = [f"{len(jobs)} jobs fetched (dry run)"]
        lines += [
            f"- {j.company_name} | {j.title} | {j.location} | {j.remote_type}"
            for j in jobs[:5]
        ]
        return "\n".join(lines)

    with db.connect() as conn:
        run_id = db.start_run(conn, source.name)
        try:
            started = db.db_now(conn)
            jobs = asyncio.run(source.fetch())
            seen, new = db.upsert_jobs(conn, jobs)
            closed = db.close_stale(conn, source.name, jobs, started)
            db.finish_run(conn, run_id, seen, new, None)
            extra = ""
            if isinstance(source, BoardSource):
                off = db.record_board_results(conn, source.name, source.results)
                failed = sum(1 for _, err in source.results.values() if err)
                extra = f", {failed} boards failed, {off} newly disabled"
            return f"{source.name}: {seen} seen, {new} new, {closed} closed{extra}"
        except Exception as e:
            db.finish_run(conn, run_id, 0, 0, str(e))
            raise


def run_harvest() -> str:
    with db.connect() as conn:
        added = harvest(conn)
    return f"harvest: new companies {added}"


def run_enrich(full_report: bool, dry_run: bool = False, sample: int = 0) -> str:
    with db.connect() as conn:
        summary, report = enrich(conn, dry_run=dry_run, sample=sample)
    return report if full_report else summary


def run_all(config: dict, skip: set[str]) -> int:
    steps: list[tuple[str, object]] = []
    steps += [(s, lambda s=s: run_source(s, config)) for s in DISCOVERY if s not in skip]
    steps.append(("harvest", run_harvest))
    steps += [(s, lambda s=s: run_source(s, config)) for s in BOARDS if s not in skip]
    steps.append(("harvest", run_harvest))  # picks up slugs for the next run
    steps.append(("enrich", lambda: run_enrich(False)))

    summary: list[str] = []
    failed = 0
    for name, step in steps:
        try:
            summary.append(step())
        except Exception as e:  # one bad source must not stop the rest
            failed += 1
            summary.append(f"{name}: FAILED ({e!r})")
            logging.exception("%s failed", name)

    print("\n=== summary ===")
    print("\n".join(summary))
    return 1 if failed else 0


def main() -> None:
    parser = argparse.ArgumentParser(prog="jobhunter")
    sub = parser.add_subparsers(dest="cmd", required=True)

    scrape = sub.add_parser("scrape", help="Run one source and store jobs")
    scrape.add_argument("source", choices=SOURCE_NAMES)
    scrape.add_argument("--dry-run", action="store_true", help="Fetch only, no DB writes")

    sub.add_parser("harvest", help="Find ATS board slugs in stored jobs and save them")

    en = sub.add_parser("enrich", help="Classify stored jobs (regions) and print a report")
    en.add_argument("--dry-run", action="store_true", help="Report only, write nothing")
    en.add_argument("--sample", type=int, default=0, help="Show N random classified and unclassified rows to spot-check")

    everything = sub.add_parser("all", help="Run every source, harvest, the boards, then enrich")
    everything.add_argument("--skip", nargs="*", default=[], choices=SOURCE_NAMES)

    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    logging.getLogger("httpx").setLevel(logging.WARNING)

    if args.cmd == "harvest":
        print(run_harvest())
    elif args.cmd == "enrich":
        print(run_enrich(True, args.dry_run, args.sample))
    elif args.cmd == "all":
        sys.exit(run_all(load_config(), set(args.skip)))
    else:
        print(run_source(args.source, load_config(), args.dry_run))
