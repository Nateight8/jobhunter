"""Turns free-text job locations into canonical region codes. The rules live in shared/regions.json."""

import json
import re
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

DATA_PATH = Path(__file__).resolve().parents[2] / "shared" / "regions.json"

# "anywhere" means worldwide, unless it is "anywhere in <somewhere>" ("anywhere in the world" still does).
_WORLDWIDE = re.compile(
    r"\b(worldwide|world-wide|globally|global|work from anywhere|anywhere)\b(?!\s+in\s+(?!the\s+world|world))",
    re.I,
)
_SPLIT = re.compile(r"\s*(?:[;|/•]|,|\(|\)|\s[-–—]+\s|\s+(?:or|and)\s+|\s&\s)\s*", re.I)
_NOISE = re.compile(
    r"\b(remote|hybrid|on-?site|from|based|in|the|only|within|across|anywhere|time\s?zones?|tz|"
    r"work|working|eligible|candidates?|located|location|office|hq|headquarters)\b",
    re.I,
)


@dataclass(frozen=True)
class _Rules:
    regions: dict
    alias: dict
    cities: dict
    us_states: frozenset
    ca_provinces: frozenset
    us_abbr: frozenset
    ca_abbr: frozenset


def _norm(s: str) -> str:
    return s.lower().strip(" .")


@lru_cache(maxsize=1)
def _load() -> _Rules:
    data = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    alias = {_norm(a): code for code, r in data["regions"].items() for a in r.get("aliases", [])}
    return _Rules(
        regions=data["regions"],
        alias=alias,
        cities={_norm(k): v for k, v in data["cities"].items()},
        us_states=frozenset(data["us_state_names"]),
        ca_provinces=frozenset(data["ca_province_names"]),
        us_abbr=frozenset(data["us_state_abbr"]),
        ca_abbr=frozenset(data["ca_province_abbr"]),
    )


def region_name(code: str) -> str:
    r = _load().regions.get(code)
    return r["name"] if r else code


def classify_text(text: str | None) -> set[str]:
    rules = _load()
    codes: set[str] = set()
    if not text:
        return codes
    if _WORLDWIDE.search(text):
        codes.add("WORLDWIDE")
    for i, raw in enumerate(_SPLIT.split(text)):
        tok = raw.strip(" .")
        if not tok:
            continue
        # "Denver, CO" / "Toronto, ON": a trailing two-letter code is a state or province
        if i > 0 and len(tok) == 2 and tok.isupper():
            if tok in rules.us_abbr:
                codes.add("US")
                continue
            if tok in rules.ca_abbr:
                codes.add("CA")
                continue
        cleaned = _norm(re.sub(r"\s+", " ", _NOISE.sub(" ", tok)))
        if not cleaned:
            continue
        code = (
            rules.alias.get(cleaned)
            or rules.cities.get(cleaned)
            or ("US" if cleaned in rules.us_states else None)
            or ("CA" if cleaned in rules.ca_provinces else None)
        )
        if code:
            codes.add(code)
    return codes


def classify_job(source: str, location: str | None, raw: dict | None) -> list[str] | None:
    """Regions a job is placed in, or None when the location says nothing usable (never guessed)."""
    raw = raw or {}
    texts = [location or ""]
    if source == "lever":
        cats = raw.get("categories") or {}
        texts += [t for t in (cats.get("allLocations") or []) if isinstance(t, str)]
    elif source == "ashby":
        texts += [s.get("location", "") for s in (raw.get("secondaryLocations") or []) if isinstance(s, dict)]

    codes: set[str] = set()
    for t in texts:
        codes |= classify_text(t)

    if not codes and source == "lever":
        country = str(raw.get("country") or "").upper()
        if country in _load().regions:
            codes.add(country)
    return sorted(codes) or None
