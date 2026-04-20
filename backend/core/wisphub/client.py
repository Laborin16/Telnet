import httpx
from tenacity import retry, stop_after_attempt, wait_exponential
from core.config import settings


class WispHubClient:
    def __init__(self):
        self._client = httpx.AsyncClient(
            base_url=settings.wisphub_api_base_url,
            headers={
                "Authorization": f"Api-Key {settings.wisphub_api_key}",
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
            timeout=httpx.Timeout(connect=10.0, read=30.0, write=10.0, pool=5.0),
        )

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=8),
        reraise=True,
    )
    async def get(self, endpoint: str, params: dict = None) -> dict:
        response = await self._client.get(endpoint, params=params)
        response.raise_for_status()
        return response.json()

    async def get_all(self, endpoint: str, params: dict = None) -> dict:
        """Trae todas las páginas de un endpoint paginado y las concatena en results."""
        merged_params = {"page_size": 1000, **(params or {})}
        first = await self.get(endpoint, params=merged_params)
        all_results = list(first.get("results", []))
        next_url = first.get("next")
        while next_url:
            # next ya viene como URL absoluta; la parseamos para extraer path+query
            from urllib.parse import urlparse, parse_qs, urlencode
            parsed = urlparse(next_url)
            next_params = {k: v[0] for k, v in parse_qs(parsed.query).items()}
            page_data = await self.get(parsed.path, params=next_params)
            all_results.extend(page_data.get("results", []))
            next_url = page_data.get("next")
        return {**first, "results": all_results, "next": None, "previous": None}

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=8),
        reraise=True,
    )
    async def post(self, endpoint: str, payload: dict = None) -> dict:
        response = await self._client.post(endpoint, json=payload)
        response.raise_for_status()
        return response.json()

    async def close(self):
        await self._client.aclose()


wisphub_client = WispHubClient()