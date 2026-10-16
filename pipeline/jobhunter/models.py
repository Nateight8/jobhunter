from datetime import datetime
from typing import Any

from pydantic import BaseModel


class RawJob(BaseModel):
    """Normalized job as produced by any source adapter."""

    source: str
    source_id: str
    url: str
    apply_url: str | None = None
    title: str
    company_name: str
    location: str | None = None
    remote_type: str = "unknown"  # remote | hybrid | onsite | unknown
    description: str | None = None
    posted_at: datetime | None = None
    raw: dict[str, Any]
