from .base import Source
from .greenhouse import GreenhouseSource


def build_source(name: str, config: dict) -> Source:
    if name == "greenhouse":
        return GreenhouseSource(config["greenhouse"]["slugs"])
    raise SystemExit(f"Unknown source: {name}")


SOURCE_NAMES = ["greenhouse"]
