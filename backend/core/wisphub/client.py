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

    async def crear_cliente(self, id_zona: int, payload: dict) -> dict:
        """Registra un nuevo cliente en WispHub. La operación es asíncrona en WispHub;
        devuelve un task_id que hay que consultar para obtener el id_servicio definitivo."""
        response = await self._client.post(
            f"/api/clientes/agregar-cliente/{id_zona}/",
            json=payload,
        )
        response.raise_for_status()
        # WispHub puede devolver 200/201/202 con cuerpo variable
        try:
            return response.json()
        except Exception:
            return {"raw": response.text}

    async def obtener_zonas(self) -> list[dict]:
        """Lista las zonas de servicio disponibles en WispHub."""
        try:
            result = await self.get("/api/zonas/", params={"page_size": 500})
            return result.get("results", result if isinstance(result, list) else [])
        except Exception:
            return []

    async def obtener_planes(self) -> list[dict]:
        """Lista los planes de internet disponibles en WispHub."""
        try:
            result = await self.get("/api/plan-internet/", params={"page_size": 500})
            return result.get("results", result if isinstance(result, list) else [])
        except Exception:
            return []

    async def obtener_routers(self) -> list[dict]:
        """Lista los routers disponibles en WispHub."""
        try:
            result = await self.get("/api/router/", params={"page_size": 500})
            return result.get("results", result if isinstance(result, list) else [])
        except Exception:
            return []

    async def obtener_zona_de_router(self, router_id: int) -> dict | None:
        """Devuelve {'id': zona_id, 'nombre': zona_nombre} consultando un cliente del router."""
        try:
            result = await self.get("/api/clientes/", params={"router": router_id, "page_size": 1})
            clientes = result.get("results", [])
            if clientes and clientes[0].get("zona"):
                return clientes[0]["zona"]
        except Exception:
            pass
        return None

    async def obtener_ips_disponibles(self, router_id: int) -> dict:
        """Calcula IPs libres y ocupadas de un router basándose en sus clientes activos."""
        import ipaddress

        try:
            result = await self.get_all("/api/clientes/", params={"router": router_id})
            clientes = result.get("results", [])
        except Exception:
            return {"disponibles": [], "ocupadas": []}

        used: dict[str, dict] = {}  # ip → {nombre, estado}
        networks: set[ipaddress.IPv4Network] = set()
        ESTADOS_ACTIVOS = {"activo", "suspendido", "moroso"}

        for c in clientes:
            ip_str = (c.get("ip") or "").strip()
            estado = (c.get("estado") or "").lower()
            try:
                ip = ipaddress.IPv4Address(ip_str)
                used[str(ip)] = {"nombre": c.get("nombre", ""), "estado": c.get("estado", "")}
                if estado in ESTADOS_ACTIVOS:
                    networks.add(ipaddress.IPv4Network(f"{ip_str}/24", strict=False))
            except ValueError:
                continue

        if not networks:
            return {"disponibles": [], "ocupadas": list(used.values())}

        disponibles_set: list[ipaddress.IPv4Address] = []
        for network in networks:
            for host in network.hosts():
                h = str(host)
                if h not in used and not h.endswith(".1"):
                    disponibles_set.append(host)

        disponibles = [str(h) for h in sorted(disponibles_set, reverse=True)]

        ocupadas = [
            {"ip": ip, "nombre": info["nombre"], "estado": info["estado"]}
            for ip, info in sorted(used.items(), key=lambda x: ipaddress.IPv4Address(x[0]))
            if info["estado"].lower() in ESTADOS_ACTIVOS
        ]

        return {"disponibles": disponibles, "ocupadas": ocupadas}

    async def close(self):
        await self._client.aclose()


wisphub_client = WispHubClient()