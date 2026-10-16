import logging
from datetime import datetime

import httpx

from ..models import RawJob
from .base import Source

log = logging.getLogger(__name__)
API = "https://remotive.com/api/remote-jobs"


def _parse_dt(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        return None


class RemotiveSource(Source):
    name = "remotive"

    def __init__(self, categories: list[str] | None = None):
        # One request per category. Remotive asks for only a few requests per day.
        self.categories = categories or ["software-dev"]

    async def fetch(self) -> list[RawJob]:
        headers = {"User-Agent": "jobhunter/0.1 (open-source job aggregator)"}
        jobs: dict[str, RawJob] = {}
        async with httpx.AsyncClient(timeout=30, headers=headers) as client:
            for category in self.categories:
                try:
                    resp = await client.get(API, params={"category": category})
                    resp.raise_for_status()
                except httpx.HTTPError as e:
                    log.warning("remotive/%s skipped: %s", category, e)
                    continue
                for j in resp.json().get("jobs", []):
                    job = RawJob(
                        source=self.name,
                        source_id=str(j["id"]),
                        url=j["url"],
                        apply_url=j["url"],
                        title=j["title"],
                        company_name=j["company_name"],
                        # Region restriction, e.g. "USA Only". Used later for eligibility.
                        location=j.get("candidate_required_location") or None,
                        remote_type="remote",
                        description=j.get("description"),
                        posted_at=_parse_dt(j.get("publication_date")),
                        raw=j,
                    )
                    jobs[job.source_id] = job
                log.info("remotive/%s: fetched", category)
        return list(jobs.values())
