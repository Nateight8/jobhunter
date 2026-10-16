from abc import ABC, abstractmethod

from ..models import RawJob


class Source(ABC):
    """Every source adapter implements this. Add a source = add one file."""

    name: str

    @abstractmethod
    async def fetch(self) -> list[RawJob]: ...
