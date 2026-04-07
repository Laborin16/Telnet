from datetime import date, datetime, timedelta
import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from core.config import settings
from modules.finanzas.models import VerificacionPago

GRAPH_URL = "https://graph.facebook.com/v19.0"


def _week_range(fecha_inicio: str | None = None) -> tuple[date, date]:
    if fecha_inicio:
        base = date.fromisoformat(fecha_inicio)
        start = base - timedelta(days=base.weekday())  # Monday of that week
    else:
        today = date.today()
        start = today - timedelta(days=today.weekday())  # Monday
    end = start + timedelta(days=6)  # Sunday
    return start, end


def _tipo_cobro(articulos: list) -> str:
    for art in articulos:
        desc = (art.get("descripcion") or "").lower()
        if "instalaci" in desc:
            return "instalacion"
    return "mensualidad"


async def get_cobros_semana(fecha_inicio: str | None = None) -> dict:
    start, end = _week_range(fecha_inicio)
    start_str = start.isoformat()
    end_str = end.isoformat()

    async with httpx.AsyncClient(
        base_url="https://api.wisphub.app",
        headers={"Authorization": f"Api-Key {settings.wisphub_api_key}"},
        timeout=30.0,
    ) as client:
        response = await client.get("/api/facturas/", params={"page_size": 1000})
        response.raise_for_status()
        data = response.json()

    items = []
    total_monto = 0.0
    total_pagado = 0.0
    total_pendiente = 0.0

    for f in data.get("results", []):
        emision = (f.get("fecha_emision") or "")[:10]
        if not (start_str <= emision <= end_str):
            continue

        monto = float(f.get("total") or 0)
        estado = f.get("estado", "")
        articulos = f.get("articulos", [])
        cliente = f.get("cliente") or {}

        total_monto += monto
        if estado == "Pagada":
            total_pagado += monto
        else:
            total_pendiente += monto

        items.append({
            "id_factura": f["id_factura"],
            "fecha_emision": emision,
            "fecha_vencimiento": (f.get("fecha_vencimiento") or "")[:10],
            "estado": estado,
            "total": monto,
            "tipo_cobro": _tipo_cobro(articulos),
            "cliente": {
                "nombre": cliente.get("nombre", "—"),
                "telefono": cliente.get("telefono", "—"),
                "direccion": cliente.get("direccion", "—"),
            },
        })

    items.sort(key=lambda x: (0 if x["estado"] == "Pendiente de Pago" else 1, x["fecha_vencimiento"]))

    return {
        "semana_inicio": start_str,
        "semana_fin": end_str,
        "count": len(items),
        "total_monto": round(total_monto, 2),
        "total_pagado": round(total_pagado, 2),
        "total_pendiente": round(total_pendiente, 2),
        "items": items,
    }


def _metodo_pago(f: dict) -> str:
    raw = f.get("metodo_pago") or f.get("forma_pago") or ""
    value = str(raw).strip().lower()
    return value if value else "no_especificado"


async def get_cobros_dia(fecha: str | None = None, db: AsyncSession | None = None) -> dict:
    fecha_str = fecha or date.today().isoformat()

    async with httpx.AsyncClient(
        base_url="https://api.wisphub.app",
        headers={"Authorization": f"Api-Key {settings.wisphub_api_key}"},
        timeout=30.0,
    ) as client:
        response = await client.get("/api/facturas/", params={"page_size": 1000})
        response.raise_for_status()
        data = response.json()

    # Cargar verificaciones locales (Banxico)
    verificaciones: dict[int, bool] = {}
    if db is not None:
        result = await db.execute(select(VerificacionPago))
        for v in result.scalars().all():
            verificaciones[v.id_factura] = v.verificado

    lista_clientes = []
    monto_total_cobrado = 0.0

    for f in data.get("results", []):
        emision = (f.get("fecha_emision") or "")[:10]
        if emision != fecha_str:
            continue

        id_factura = f["id_factura"]
        monto = float(f.get("total") or 0)
        estado = f.get("estado", "")
        # verificado viene de la DB local (Banxico), no de WispHub
        verificado = verificaciones.get(id_factura, False)
        articulos = f.get("articulos", [])
        cliente = f.get("cliente") or {}

        if verificado:
            monto_total_cobrado += monto

        lista_clientes.append({
            "id_factura": id_factura,
            "fecha_pago": emision,
            "estado": estado,
            "verificado": verificado,
            "monto_individual": monto,
            "metodo_pago": _metodo_pago(f),
            "tipo_cobro": _tipo_cobro(articulos),
            "cliente": {
                "nombre": cliente.get("nombre", "—"),
                "telefono": cliente.get("telefono", "—"),
                "direccion": cliente.get("direccion", "—"),
            },
        })

    lista_clientes.sort(key=lambda x: (0 if x["verificado"] else 1, x["id_factura"]))

    return {
        "fecha": fecha_str,
        "numero_total_pagos": len(lista_clientes),
        "monto_total_cobrado": round(monto_total_cobrado, 2),
        "lista_clientes": lista_clientes,
    }


async def toggle_verificacion(id_factura: int, notas: str | None, db: AsyncSession) -> dict:
    result = await db.execute(
        select(VerificacionPago).where(VerificacionPago.id_factura == id_factura)
    )
    registro = result.scalar_one_or_none()

    if registro is None:
        registro = VerificacionPago(
            id_factura=id_factura,
            verificado=True,
            fecha_verificacion=datetime.utcnow(),
            notas=notas,
        )
        db.add(registro)
    else:
        registro.verificado = not registro.verificado
        registro.fecha_verificacion = datetime.utcnow() if registro.verificado else None
        registro.notas = notas if notas is not None else registro.notas

    await db.commit()
    return {
        "id_factura": id_factura,
        "verificado": registro.verificado,
        "fecha_verificacion": registro.fecha_verificacion.isoformat() if registro.fecha_verificacion else None,
        "notas": registro.notas,
    }
