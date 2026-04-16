import asyncio
from datetime import date, datetime
from core.wisphub.client import WispHubClient
from modules.clients.schemas import ClientItem, ClientListResponse, ClientDetail

_FECHA_PAGO_FMTS = (
    "%d/%m/%Y %H:%M:%S",
    "%d/%m/%Y %H:%M",
    "%d/%m/%Y",
    "%Y-%m-%dT%H:%M:%S",
    "%Y-%m-%d",
)


def _parse_fecha_pago(f: dict) -> date | None:
    """Parsea fecha_pago de la factura; cae a fecha_vencimiento si no existe."""
    fp_raw = (f.get("fecha_pago") or "").strip()
    if fp_raw:
        for fmt in _FECHA_PAGO_FMTS:
            try:
                return datetime.strptime(fp_raw[:19], fmt).date()
            except ValueError:
                continue
    fv_str = (f.get("fecha_vencimiento") or "")[:10]
    if fv_str:
        try:
            return date.fromisoformat(fv_str)
        except ValueError:
            pass
    return None


def _build_vencimiento_map(facturas_raw: dict) -> dict[int, date]:
    """Build map of id_servicio → fecha_pago de la factura pendiente más próxima."""
    vmap: dict[int, date] = {}
    for f in facturas_raw.get("results", []):
        if f.get("estado") != "Pendiente de Pago":
            continue
        fp = _parse_fecha_pago(f)
        if not fp:
            continue
        for art in f.get("articulos", []):
            srv_id = art.get("servicio", {}).get("id_servicio")
            if srv_id and (srv_id not in vmap or fp < vmap[srv_id]):
                vmap[srv_id] = fp
    return vmap


def _apply_alerta(estado: str, facturas_pendientes: bool, dias: int | None) -> str:
    if estado == "Suspendido":
        return "suspendido"
    if facturas_pendientes and dias is not None and dias <= 0:
        return "critico"
    if facturas_pendientes and dias is not None and dias <= 3:
        return "pendiente"
    return "normal"


class ClientService:
    def __init__(self, wisphub: WispHubClient):
        self.wisphub = wisphub

    async def list_clients(self, page: int = 1, page_size: int = 25, status: str = None, search: str = None) -> dict:
        clients_raw, facturas_raw = await asyncio.gather(
            self.wisphub.get("/api/clientes/", params={}),
            self.wisphub.get("/api/facturas/", params={"page_size": 1000}),
        )
        response = ClientListResponse(**clients_raw)
        vmap = _build_vencimiento_map(facturas_raw)

        today = date.today()
        for client in response.results:
            fv = vmap.get(client.id_servicio)
            if fv:
                client.fecha_corte = fv
                client.dias_para_corte = (fv - today).days
            elif client.fecha_corte:
                client.dias_para_corte = (client.fecha_corte - today).days

            has_pending = client.estado_facturas == "Pendiente de Pago"
            client.alerta_corte = _apply_alerta(client.estado, has_pending, client.dias_para_corte)

        clients = response.results

        if status:
            clients = [c for c in clients if c.estado.lower() == status.lower()]
        if search:
            clients = [c for c in clients if search.lower() in c.nombre.lower()]

        total = len(clients)
        start = (page - 1) * page_size
        end = start + page_size
        total_pages = (total + page_size - 1) // page_size

        return {
            "count": total,
            "total_pages": total_pages,
            "page": page,
            "page_size": page_size,
            "results": [c.model_dump() for c in clients[start:end]],
        }

    async def get_client(self, client_id: int) -> dict:
        detail_raw, facturas_raw = await asyncio.gather(
            self.wisphub.get(f"/api/clientes/{client_id}/"),
            self.wisphub.get("/api/facturas/", params={"page_size": 1000}),
        )
        detail = ClientDetail(**detail_raw)
        vmap = _build_vencimiento_map(facturas_raw)

        today = date.today()
        fv = vmap.get(client_id)
        if fv:
            detail.fecha_corte = fv
            detail.dias_para_corte = (fv - today).days
        elif detail.fecha_corte:
            detail.dias_para_corte = (detail.fecha_corte - today).days

        detail.alerta_corte = _apply_alerta(detail.estado, not detail.facturas_pagadas, detail.dias_para_corte)
        return detail.model_dump()

    async def suspend_client(self, client_id: int) -> dict:
        return await self.wisphub.post("/api/clientes/desactivar/", payload={"servicios": [client_id]})

    async def activate_client(self, client_id: int) -> dict:
        return await self.wisphub.post("/api/clientes/activar/", payload={"servicios": [client_id]})
