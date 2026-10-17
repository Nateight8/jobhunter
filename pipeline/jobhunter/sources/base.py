import asyncio
import logging
from abc import ABC, abstractmethod

import httpx

from ..models import RawJob

log = logging.getLogger(__name__)


class Source(ABC):
    """Every source adapter implements this. Add a source = add one file."""

    name: str

    @abstractmethod
    async def fetch(self) -> list[RawJob]: ...


class BoardSource(Source):
    """Per-company ATS boards. Subclasses only provide url(), params and parse().

    After fetch(), `results` maps slug -> (job_count, error). error is None on
    success, so callers can tell an empty board from a failed one.
    """

    params: dict = {}
    board_timeout = 60

    def __init__(self, slugs: list[str], concurrency: int = 5):
        self.slugs = slugs
        self.concurrency = concurrency
        self.results: dict[str, tuple[int | None, str | None]] = {}

    @abstractmethod
    def url(self, slug: str) -> str: ...

    @abstractmethod
    def parse(self, slug: str, data) -> list[RawJob]: ...

    async def fetch(self) -> list[RawJob]:
        sem = asyncio.Semaphore(self.concurrency)
        headers = {"User-Agent": "jobhunter/0.1 (open-source job aggregator)"}
        async with httpx.AsyncClient(
            timeout=httpx.Timeout(30, connect=10), headers=headers
        ) as client:
            boards = await asyncio.gather(
                *(self._board(client, sem, slug) for slug in self.slugs)
            )
        return [job for board in boards for job in board]

    async def _board(
        self, client: httpx.AsyncClient, sem: asyncio.Semaphore, slug: str
    ) -> list[RawJob]:
        async with sem:
            try:
                async with asyncio.timeout(self.board_timeout):
                    resp = await client.get(self.url(slug), params=self.params)
                    resp.raise_for_status()
                    data = resp.json()
            except (httpx.HTTPError, TimeoutError, ValueError) as e:
                log.warning("%s/%s skipped: %r", self.name, slug, e)
                self.results[slug] = (None, repr(e)[:300])
                return []

        jobs = self.parse(slug, data)
        self.results[slug] = (len(jobs), None)
        log.info("%s/%s: %d jobs", self.name, slug, len(jobs))
        return jobs
