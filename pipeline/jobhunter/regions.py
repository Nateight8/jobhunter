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
# Separate locations: "Berlin, DE; Toronto, ON", "Remote - US", "Dublin or London"
_LOC_SPLIT = re.compile(r"\s*(?:[;|/•]|\(|\)|\s[-–—]+\s|\s+(?:or|and)\s+|\s&\s)\s*", re.I)
# "US-Remote", "CA-Toronto": a two-letter country prefix
_PREFIX = re.compile(r"^([A-Z]{2})-\S")
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


def _classify_location(rules: _Rules, loc: str) -> set[str]:
    """One location, e.g. 'Cambridge, MA'. Explicit names beat cities; abbreviations are checked last."""
    strong: set[str] = set()  # country, region, state and province names, country prefixes
    cities: set[str] = set()
    abbrs: list[str] = []

    for i, raw in enumerate(loc.split(",")):
        tok = raw.strip(" .")
        if not tok:
            continue
        if i > 0 and len(tok) == 2 and tok.isupper():
            abbrs.append("GB" if tok == "UK" else tok)
            continue
        m = _PREFIX.match(tok)
        if m:
            code = "GB" if m.group(1) == "UK" else m.group(1)
            if code in rules.regions:
                strong.add(code)
            continue
        cleaned = _norm(re.sub(r"\s+", " ", _NOISE.sub(" ", tok)))
        if not cleaned:
            continue
        if cleaned in rules.cities:
            cities.add(rules.cities[cleaned])
        code = (
            rules.alias.get(cleaned)
            or ("US" if cleaned in rules.us_states else None)
            or ("CA" if cleaned in rules.ca_provinces else None)
        )
        if code:
            strong.add(code)

    for tok in abbrs:
        if tok in strong or tok in cities:
            continue  # "Berlin, DE" / "Amsterdam, NL": the abbreviation agrees with what we already have
        if tok in rules.us_abbr:  # "Cambridge, MA": a state beats a same-named foreign city
            strong.add("US")
            cities = {c for c in cities if c == "US"}
        elif tok in rules.ca_abbr:
            strong.add("CA")
            cities = {c for c in cities if c == "CA"}
        elif tok in rules.regions:
            strong.add(tok)

    return strong or cities


def classify_text(text: str | None) -> set[str]:
    codes: set[str] = set()
    if not text:
        return codes
    if _WORLDWIDE.search(text):
        codes.add("WORLDWIDE")
    rules = _load()
    for loc in _LOC_SPLIT.split(text):
        loc = loc.strip()
        if loc:
            codes |= _classify_location(rules, loc)
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
