import random
from collections import Counter

import psycopg

from .regions import classify_job, region_name


def enrich(conn: psycopg.Connection, dry_run: bool = False, sample: int = 0) -> tuple[str, str]:
    """Classify every job's regions from stored data (no scraping). Returns (summary, full report)."""
    rows = conn.execute("SELECT id, source, location, raw, regions FROM jobs").fetchall()

    updates: list[tuple[list[str] | None, object]] = []
    by_source: dict[str, list[int]] = {}
    codes: Counter[str] = Counter()
    unknown: Counter[str] = Counter()
    good: list[tuple[str, list[str]]] = []
    bad: list[str] = []
    classified = 0

    for job_id, source, location, raw, current in rows:
        new = classify_job(source, location, raw)
        stats = by_source.setdefault(source, [0, 0])
        stats[1] += 1
        if new:
            classified += 1
            stats[0] += 1
            codes.update(new)
            good.append((location or "(no location)", new))
        else:
            label = (location or "(no location)").strip()
            unknown[label] += 1
            bad.append(label)
        if new != current:
            updates.append((new, job_id))

    if not dry_run and updates:
        with conn.transaction():
            with conn.cursor() as cur:
                cur.executemany("UPDATE jobs SET regions = %s::text[] WHERE id = %s", updates)

    total = len(rows)
    pct = lambda a, b: f"{(100 * a / b):.0f}%" if b else "0%"
    summary = f"enrich: {classified}/{total} classified ({pct(classified, total)}), {len(updates)} changed"

    out = [summary + (" (dry run, nothing written)" if dry_run else ""), "", "By source:"]
    for src, (c, t) in sorted(by_source.items(), key=lambda kv: -kv[1][1]):
        out.append(f"  {src:<12}{t:>6} jobs   {c:>6} classified ({pct(c, t)})")
    out += ["", "Top regions:"]
    for code, n in codes.most_common(15):
        out.append(f"  {code:<14}{n:>6}   {region_name(code)}")
    out += ["", "Most common unclassified locations (add aliases or cities in shared/regions.json, then re-run):"]
    for label, n in unknown.most_common(40):
        out.append(f"  {n:>6}  {label[:90]}")

    if sample:
        rng = random.Random()
        out += ["", f"Random sample of {sample} classified (location -> regions):"]
        for loc, regs in rng.sample(good, min(sample, len(good))):
            out.append(f"  {loc[:70]:<70} -> {', '.join(regs)}")
        out += ["", f"Random sample of {sample} unclassified locations:"]
        for loc in rng.sample(bad, min(sample, len(bad))):
            out.append(f"  {loc[:90]}")

    return summary, "\n".join(out)
