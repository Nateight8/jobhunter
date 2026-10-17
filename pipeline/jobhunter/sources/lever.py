from datetime import datetime, timezone

from ..models import RawJob
from ..normalize import infer_remote_type
from .base import BoardSource


class LeverSource(BoardSource):
    name = "lever"
    params = {"mode": "json"}

    def url(self, slug: str) -> str:
        return f"https://api.lever.co/v0/postings/{slug}"  # EU boards: api.eu.lever.co

    def parse(self, slug: str, data) -> list[RawJob]:
        jobs = []
        for j in data:
            location = (j.get("categories") or {}).get("location")
            created = j.get("createdAt")
            workplace = (j.get("workplaceType") or "").lower()
            remote = (
                workplace
                if workplace in ("remote", "hybrid", "onsite")
                else infer_remote_type(location, j["text"])
            )
            jobs.append(
                RawJob(
                    source=self.name,
                    source_id=f"{slug}:{j['id']}",
                    url=j["hostedUrl"],
                    apply_url=j.get("applyUrl") or j["hostedUrl"],
                    title=j["text"],
                    company_name=slug,
                    location=location,
                    remote_type=remote,
                    description=j.get("description"),
                    posted_at=datetime.fromtimestamp(created / 1000, tz=timezone.utc) if created else None,
                    raw=j,
                )
            )
        return jobs
