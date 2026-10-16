from .base import Source
from .greenhouse import GreenhouseSource
from .remotive import RemotiveSource


def build_source(name: str, config: dict) -> Source:
    if name == "greenhouse":
        return GreenhouseSource(config["greenhouse"]["slugs"])
    if name == "remotive":
        return RemotiveSource(config.get("remotive", {}).get("categories"))
    raise SystemExit(f"Unknown source: {name}")


SOURCE_NAMES = ["greenhouse", "remotive"]
