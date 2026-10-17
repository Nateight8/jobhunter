import html
from datetime import datetime

from ..models import RawJob
from ..normalize import infer_remote_type
from .base import BoardSource


def _parse_dt(value: str | None) -> datetime | None:
    try:
        return datetime.fromisoformat(value) if value else None
    except ValueError:
        return None


class GreenhouseSource(BoardSource):
    name = "greenhouse"
    params = {"content": "true"}

    def url(self, slug: str) -> str:
        return f"https://boards-api.greenhouse.io/v1/boards/{slug}/jobs"

    def parse(self, slug: str, data) -> list[RawJob]:
        jobs = []
        for j in data.get("jobs", []):
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
        return jobs
