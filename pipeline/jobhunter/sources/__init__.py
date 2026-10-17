from .. import db
from .ashby import AshbySource
from .base import BoardSource, Source
from .greenhouse import GreenhouseSource
from .hackernews import HackerNewsSource
from .lever import LeverSource
from .remoteok import RemoteOKSource
from .remotive import RemotiveSource


def _slugs(ats: str, config: dict) -> list[str]:
    """sources.toml bootstrap slugs plus harvested ones, minus disabled boards."""
    slugs = set(config.get(ats, {}).get("slugs", []))
    try:
        with db.connect() as conn:
            slugs |= set(db.ats_slugs(conn, ats))
            slugs -= set(db.disabled_slugs(conn, ats))
    except Exception:
        pass  # DB unavailable (dry run without Postgres): toml list only
    return sorted(slugs)


def build_source(name: str, config: dict) -> Source:
    if name == "greenhouse":
        return GreenhouseSource(_slugs("greenhouse", config))
    if name == "lever":
        return LeverSource(_slugs("lever", config))
    if name == "ashby":
        return AshbySource(_slugs("ashby", config))
    if name == "remotive":
        return RemotiveSource(config.get("remotive", {}).get("categories"))
    if name == "remoteok":
        return RemoteOKSource()
    if name == "hackernews":
        return HackerNewsSource(config.get("hackernews", {}).get("threads", 2))
    raise SystemExit(f"Unknown source: {name}")


SOURCE_NAMES = ["greenhouse", "lever", "ashby", "remotive", "remoteok", "hackernews"]
