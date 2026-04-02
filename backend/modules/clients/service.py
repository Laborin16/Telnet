from datetime import date
from core.wisphub.client import WispHubClient
from modules.clients.schemas import ClientItem, ClientListResponse


class ClientService:
    def __init__(self, wisphub: WispHubClient):
        self.wisphub = wisphub

    async def list_clients(self, page: int = 1, status: str = None, search: str = None) -> dict:
        params = {"page": page}
        if status:
            params["estado"] = status
        if search:
            params["search"] = search

        raw = await self.wisphub.get("/api/clientes/", params=params)
        response = ClientListResponse(**raw)

        today = date.today()
        for client in response.results:
            if client.fecha_corte:
                client.dias_para_corte = (client.fecha_corte - today).days
                if client.dias_para_corte < 0:
                    client.alerta_corte = "vencido"
                elif client.dias_para_corte <= 3:
                    client.alerta_corte = "critico"
                elif client.dias_para_corte <= 7:
                    client.alerta_corte = "proximo"
                else:
                    client.alerta_corte = "normal"

        return response.model_dump()

    async def get_client(self, client_id: int) -> dict:
        raw = await self.wisphub.get(f"/api/clientes/{client_id}/")
        return raw