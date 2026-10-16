import logging
from datetime import datetime

import httpx

from ..models import RawJob
from .base import Source

log = logging.getLogger(__name__)
API = "https://remoteok.com/api"


def _parse_dt(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        return None


class RemoteOKSource(Source):
    name = "remoteok"

    async def fetch(self) -> list[RawJob]:
        headers = {"User-Agent": "jobhunter/0.1 (open-source job aggregator)"}
        async with httpx.AsyncClient(timeout=30, headers=headers) as client:
            try:
                resp = await client.get(API)
                resp.raise_for_status()
            except httpx.HTTPError as e:
                log.warning("remoteok skipped: %s", e)
                return []

        jobs: list[RawJob] = []
        for j in resp.json():
            if "id" not in j:  # first element is a legal notice
                continue
            jobs.append(
                RawJob(
                    source=self.name,
                    source_id=str(j["id"]),
                    url=j["url"],
                    apply_url=j.get("apply_url") or j["url"],
                    title=j["position"],
                    company_name=j["company"],
                    location=j.get("location") or None,
                    remote_type="remote",
                    description=j.get("description"),
                    posted_at=_parse_dt(j.get("date")),
                    raw=j,  # includes tags, e.g. ["react", "node"]
                )
            )
        log.info("remoteok: %d jobs", len(jobs))
        return jobs
