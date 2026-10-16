from .ashby import AshbySource
from .base import Source
from .greenhouse import GreenhouseSource
from .lever import LeverSource
from .remoteok import RemoteOKSource
from .remotive import RemotiveSource


def build_source(name: str, config: dict) -> Source:
    if name == "greenhouse":
        return GreenhouseSource(config["greenhouse"]["slugs"])
    if name == "lever":
        return LeverSource(config["lever"]["slugs"])
    if name == "ashby":
        return AshbySource(config["ashby"]["slugs"])
    if name == "remotive":
        return RemotiveSource(config.get("remotive", {}).get("categories"))
    if name == "remoteok":
        return RemoteOKSource()
    raise SystemExit(f"Unknown source: {name}")


SOURCE_NAMES = ["greenhouse", "lever", "ashby", "remotive", "remoteok"]
