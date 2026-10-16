import hashlib
import re


def infer_remote_type(*texts: str | None) -> str:
    blob = " ".join(t for t in texts if t).lower()
    if "hybrid" in blob:
        return "hybrid"
    if "remote" in blob:
        return "remote"
    return "unknown"


def dedupe_key(company: str, title: str, location: str | None) -> str:
    def norm(s: str | None) -> str:
        return re.sub(r"[^a-z0-9]+", " ", (s or "").lower()).strip()

    raw = f"{norm(company)}|{norm(title)}|{norm(location)}"
    return hashlib.sha1(raw.encode()).hexdigest()
