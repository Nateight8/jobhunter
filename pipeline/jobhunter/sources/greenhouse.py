import asyncio
import html
import logging
from datetime import datetime

import httpx

from ..models import RawJob
from ..normalize import infer_remote_type
from .base import Source

log = logging.getLogger(__name__)
API = "https://boards-api.greenhouse.io/v1/boards/{slug}/jobs"


def _parse_dt(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        return None


class GreenhouseSource(Source):
    name = "greenhouse"

    def __init__(self, slugs: list[str], concurrency: int = 5):
        self.slugs = slugs
        self.concurrency = concurrency

    async def fetch(self) -> list[RawJob]:
        sem = asyncio.Semaphore(self.concurrency)
        headers = {"User-Agent": "jobhunter/0.1 (open-source job aggregator)"}
        async with httpx.AsyncClient(timeout=30, headers=headers) as client:
            boards = await asyncio.gather(
                *(self._board(client, sem, slug) for slug in self.slugs)
            )
        return [job for board in boards for job in board]

    async def _board(
        self, client: httpx.AsyncClient, sem: asyncio.Semaphore, slug: str
    ) -> list[RawJob]:
        async with sem:
            try:
                resp = await client.get(API.format(slug=slug), params={"content": "true"})
                resp.raise_for_status()
            except httpx.HTTPError as e:
                log.warning("greenhouse/%s skipped: %s", slug, e)
                return []

        jobs: list[RawJob] = []
        for j in resp.json().get("jobs", []):
            location = (j.get("location") or {}).get("name")
            jobs.append(
                RawJob(
                    source=self.name,
                    source_id=f"{slug}:{j['id']}",
                    url=j["absolute_url"],
                    apply_url=j["absolute_url"],
                    title=j["title"],
                    company_name=j.get("company_name") or slug,
                    location=location,
                    remote_type=infer_remote_type(location, j["title"]),
                    description=html.unescape(j["content"]) if j.get("content") else None,
                    posted_at=_parse_dt(j.get("first_published")),
                    raw=j,
                )
            )
        log.info("greenhouse/%s: %d jobs", slug, len(jobs))
        return jobs
