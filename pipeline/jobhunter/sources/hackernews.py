import asyncio
import html
import logging
import re
from datetime import datetime

import httpx

from ..models import RawJob
from ..normalize import infer_remote_type
from .base import Source

log = logging.getLogger(__name__)
SEARCH = "https://hn.algolia.com/api/v1/search_by_date"
ITEM = "https://hn.algolia.com/api/v1/items/{id}"
TAG = re.compile(r"<[^>]+>")
HREF = re.compile(r'href="([^"]+)"')
ATS_HOSTS = ("greenhouse.io", "lever.co", "ashbyhq.com", "workable.com", "smartrecruiters.com")


def _parse_dt(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        return None


def _pick_apply_url(links: list[str]) -> str | None:
    for link in links:
        if any(host in link for host in ATS_HOSTS):
            return link
    return links[0] if links else None


class HackerNewsSource(Source):
    """Monthly 'Ask HN: Who is hiring?' threads. Each top-level comment is one posting."""

    name = "hackernews"

    def __init__(self, threads: int = 2):
        self.threads = threads

    async def fetch(self) -> list[RawJob]:
        headers = {"User-Agent": "jobhunter/0.1 (open-source job aggregator)"}
        async with httpx.AsyncClient(
            timeout=httpx.Timeout(60, connect=10), headers=headers
        ) as client:
            try:
                async with asyncio.timeout(120):
                    thread_ids = await self._thread_ids(client)
                    jobs: list[RawJob] = []
                    for tid in thread_ids:
                        jobs.extend(await self._thread(client, tid))
            except (httpx.HTTPError, TimeoutError) as e:
                log.warning("hackernews failed: %s", e)
                return []
        return jobs

    async def _thread_ids(self, client: httpx.AsyncClient) -> list[str]:
        resp = await client.get(
            SEARCH,
            params={
                "query": "Ask HN: Who is hiring?",
                "tags": "story,author_whoishiring",
                "hitsPerPage": 10,
            },
        )
        resp.raise_for_status()
        hits = [
            h
            for h in resp.json()["hits"]
            if h["title"].startswith("Ask HN: Who is hiring?")
        ]
        return [h["objectID"] for h in hits[: self.threads]]

    async def _thread(self, client: httpx.AsyncClient, thread_id: str) -> list[RawJob]:
        resp = await client.get(ITEM.format(id=thread_id))
        resp.raise_for_status()
        children = resp.json().get("children", [])

        jobs: list[RawJob] = []
        for c in children:
            text = c.get("text")
            if not text:  # deleted or dead
                continue
            first = TAG.sub("", html.unescape(text.split("<p>")[0])).strip()
            if "|" not in first:  # postings follow "Company | Role | Location | ..."
                continue
            parts = [p.strip() for p in first.split("|")]
            links = [html.unescape(m) for m in HREF.findall(text)]
            blob = first.lower()
            remote = infer_remote_type(first)
            if remote == "unknown" and ("onsite" in blob or "on-site" in blob):
                remote = "onsite"

            jobs.append(
                RawJob(
                    source=self.name,
                    source_id=str(c["id"]),
                    url=f"https://news.ycombinator.com/item?id={c['id']}",
                    apply_url=_pick_apply_url(links),
                    title=parts[1] if len(parts) > 1 else "See posting",
                    company_name=parts[0][:120],
                    location=parts[2] if len(parts) > 2 else None,
                    remote_type=remote,
                    # Unescaped so the harvester can regex-match ATS links in the HTML
                    description=html.unescape(text),
                    posted_at=_parse_dt(c.get("created_at")),
                    raw={"thread_id": thread_id, "author": c.get("author"), "links": links},
                )
            )
        log.info("hackernews/thread %s: %d postings", thread_id, len(jobs))
        return jobs
