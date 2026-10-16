import asyncio
import logging
from datetime import datetime, timezone

import httpx

from ..models import RawJob
from ..normalize import infer_remote_type
from .base import Source

log = logging.getLogger(__name__)
API = "https://api.lever.co/v0/postings/{slug}"  # EU-hosted boards: api.eu.lever.co


class LeverSource(Source):
    name = "lever"

    def __init__(self, slugs: list[str], concurrency: int = 5):
        self.slugs = slugs
        self.concurrency = concurrency

    async def fetch(self) -> list[RawJob]:
        sem = asyncio.Semaphore(self.concurrency)
        headers = {"User-Agent": "jobhunter/0.1 (open-source job aggregator)"}
        async with httpx.AsyncClient(timeout=httpx.Timeout(30, connect=10), headers=headers) as client:
            boards = await asyncio.gather(
                *(self._board(client, sem, slug) for slug in self.slugs)
            )
        return [job for board in boards for job in board]

    async def _board(
        self, client: httpx.AsyncClient, sem: asyncio.Semaphore, slug: str
    ) -> list[RawJob]:
        async with sem:
            try:
              async with asyncio.timeout(60):
                resp = await client.get(API.format(slug=slug), params={"mode": "json"})
                resp.raise_for_status()
            except httpx.HTTPError as e:
                log.warning("lever/%s skipped: %s", slug, e)
                return []

        jobs: list[RawJob] = []
        for j in resp.json():
            location = (j.get("categories") or {}).get("location")
            created = j.get("createdAt")
            workplace = (j.get("workplaceType") or "").lower()
            remote = workplace if workplace in ("remote", "hybrid", "onsite") else infer_remote_type(location, j["text"])
            jobs.append(
                RawJob(
                    source=self.name,
                    source_id=f"{slug}:{j['id']}",
                    url=j["hostedUrl"],
                    apply_url=j.get("applyUrl") or j["hostedUrl"],
                    title=j["text"],
                    company_name=slug,  # Lever doesn't return a display name
                    location=location,
                    remote_type=remote,
                    description=j.get("description"),
                    posted_at=datetime.fromtimestamp(created / 1000, tz=timezone.utc) if created else None,
                    raw=j,
                )
            )
        log.info("lever/%s: %d jobs", slug, len(jobs))
        return jobs
