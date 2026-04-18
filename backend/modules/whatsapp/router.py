from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from db.session import get_db
from core.dependencies import get_usuario
from core.wisphub.client import wisphub_client
from modules.whatsapp.service import ejecutar_recordatorios, send_template_message, _parse_fecha_referencia, SUSPENSION_HABILITADA, TEMPLATES
from modules.auditlog.service import log_accion

router = APIRouter()


class TestMessageRequest(BaseModel):
    phone: str
    template_name: str = "hello_world"


@router.post("/test")
async def test_mensaje(body: TestMessageRequest):
    result = await send_template_message(body.phone, body.template_name, "Test", 0.0)
    if result["status_code"] not in (200, 201):
        raise HTTPException(status_code=400, detail=result["body"])
    return result["body"]


class EnviarIndividualRequest(BaseModel):
    phone: str
    nombre: str
    monto: float
    dias_vencido: int


@router.post("/enviar-individual")
async def enviar_individual(
    body: EnviarIndividualRequest,
    db: AsyncSession = Depends(get_db),
    usuario: dict = Depends(get_usuario),
):
    dias_key = body.dias_vencido if body.dias_vencido in TEMPLATES else (4 if body.dias_vencido > 4 else None)
    if dias_key is None:
        raise HTTPException(status_code=400, detail="No hay plantilla para este número de días.")

    template = TEMPLATES[dias_key]
    phone = body.phone.split(",")[0].strip()
    result = await send_template_message(phone, template, body.nombre, body.monto)
    exitoso = result["status_code"] in (200, 201)

    await log_accion(
        db=db,
        usuario=usuario,
        accion="WHATSAPP_INDIVIDUAL",
        modulo="whatsapp",
        entidad="mensaje",
        descripcion=f"{'Mensaje enviado' if exitoso else 'ERROR al enviar'} a {body.nombre} ({phone}) — plantilla: {template}",
        datos_extra={"respuesta": result["body"]},
    )

    if not exitoso:
        raise HTTPException(status_code=400, detail=result["body"])

    return result["body"]


def _build_clientes_map(clientes_data: dict) -> dict[int, dict]:
    clientes_map: dict[int, dict] = {}
    for c in clientes_data.get("results", []):
        sid = c.get("id_servicio")
        if sid:
            clientes_map[sid] = c
    return clientes_map


def _enrich_factura(f: dict, clientes_map: dict[int, dict]) -> None:
    for art in f.get("articulos", []):
        srv_id = (art.get("servicio") or {}).get("id_servicio")
        if srv_id and srv_id in clientes_map:
            c = clientes_map[srv_id]
            f["cliente"] = {
                "nombre": c.get("nombre", "—"),
                "telefono": c.get("telefono", ""),
                "id_servicio": srv_id,
            }
            break


@router.get("/resumen")
async def resumen_recordatorios():
    from datetime import date
    today = date.today()

    facturas_data = await wisphub_client.get("/api/facturas/", params={"page_size": 1000})
    clientes_data = await wisphub_client.get("/api/clientes/", params={"page_size": 1000})
    clientes_map = _build_clientes_map(clientes_data)

    conteos = {0: 0, 1: 0, 2: 0, 3: 0, 4: 0}
    for f in facturas_data.get("results", []):
        if f.get("estado") != "Pendiente de Pago":
            continue
        _enrich_factura(f, clientes_map)
        fecha_ref = _parse_fecha_referencia(f)
        if fecha_ref is None:
            continue
        dias = (today - fecha_ref).days
        if dias in conteos:
            conteos[dias] += 1

    return {
        "fecha": today.isoformat(),
        "suspension_habilitada": SUSPENSION_HABILITADA,
        "resumen": [
            {"dia": 0, "label": "Vencen hoy", "count": conteos[0]},
            {"dia": 1, "label": "1 día vencido", "count": conteos[1]},
            {"dia": 2, "label": "2 días vencido", "count": conteos[2]},
            {"dia": 3, "label": "3 días vencido", "count": conteos[3]},
            {"dia": 4, "label": "4 días vencido", "count": conteos[4]},
        ],
        "total": sum(conteos.values()),
    }


@router.post("/ejecutar-recordatorios")
async def ejecutar(
    db: AsyncSession = Depends(get_db),
    usuario: dict = Depends(get_usuario),
):
    facturas_data = await wisphub_client.get("/api/facturas/", params={"page_size": 1000})
    clientes_data = await wisphub_client.get("/api/clientes/", params={"page_size": 1000})
    clientes_map = _build_clientes_map(clientes_data)

    facturas = []
    for f in facturas_data.get("results", []):
        if f.get("estado") != "Pendiente de Pago":
            continue
        _enrich_factura(f, clientes_map)
        facturas.append(f)

    resultado = await ejecutar_recordatorios(facturas)

    await log_accion(
        db=db,
        usuario=usuario,
        accion="WHATSAPP_RECORDATORIOS",
        modulo="whatsapp",
        entidad="recordatorios",
        descripcion=(
            f"Enviados: {resultado['enviados']}, "
            f"Errores: {resultado['errores']}, "
            f"Sin teléfono: {sum(1 for d in resultado['detalle'] if d['estado'] == 'sin_telefono')}, "
            f"Suspendidos: {resultado['suspendidos']}"
        ),
        datos_extra={"detalle": resultado["detalle"]},
    )

    return resultado
