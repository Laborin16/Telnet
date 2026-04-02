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