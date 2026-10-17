from datetime import datetime

from ..models import RawJob
from ..normalize import infer_remote_type
from .base import BoardSource


def _parse_dt(value: str | None) -> datetime | None:
    try:
        return datetime.fromisoformat(value) if value else None
    except ValueError:
        return None


class AshbySource(BoardSource):
    name = "ashby"
    params = {"includeCompensation": "true"}

    def url(self, slug: str) -> str:
        return f"https://api.ashbyhq.com/posting-api/job-board/{slug}"

    def parse(self, slug: str, data) -> list[RawJob]:
        jobs = []
        for j in data.get("jobs", []):
            if j.get("isListed") is False:
                continue
            location = j.get("location")
            workplace = (j.get("workplaceType") or "").lower()
            if workplace in ("remote", "hybrid", "onsite"):
                remote = workplace
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
                    company_name=slug,
                    location=location,
                    remote_type=remote,
                    description=j.get("descriptionHtml"),
                    posted_at=_parse_dt(j.get("publishedAt")),
                    raw=j,
                )
            )
        return jobs
