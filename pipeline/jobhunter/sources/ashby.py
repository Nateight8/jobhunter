import asyncio
import logging
from datetime import datetime

import httpx

from ..models import RawJob
from ..normalize import infer_remote_type
from .base import Source

log = logging.getLogger(__name__)
API = "https://api.ashbyhq.com/posting-api/job-board/{slug}"


def _parse_dt(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        return None


class AshbySource(Source):
    name = "ashby"

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
                resp = await client.get(
                    API.format(slug=slug), params={"includeCompensation": "true"}
                )
                resp.raise_for_status()
            except httpx.HTTPError as e:
                log.warning("ashby/%s skipped: %s", slug, e)
                return []

        jobs: list[RawJob] = []
        for j in resp.json().get("jobs", []):
            if j.get("isListed") is False:
                continue
            location = j.get("location")
            workplace = (j.get("workplaceType") or "").lower()
            if workplace in ("remote", "hybrid"):
                remote = workplace
            elif workplace == "onsite":
                remote = "onsite"
            elif j.get("isRemote"):
                remote = "remote"
            else:
                remote = infer_remote_type(location, j["title"])
            jobs.append(
                RawJob(
                    source=self.name,
                    source_id=f"{slug}:{j['id']}",
                    url=j["jobUrl"],
                    apply_url=j.get("applyUrl") or j["jobUrl"],
                    title=j["title"],
                    company_name=slug,  # Ashby doesn't return a display name
                    location=location,
                    remote_type=remote,
                    description=j.get("descriptionHtml"),
                    posted_at=_parse_dt(j.get("publishedAt")),
                    raw=j,
                )
            )
        log.info("ashby/%s: %d jobs", slug, len(jobs))
        return jobs
