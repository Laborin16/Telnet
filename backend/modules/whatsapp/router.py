import asyncio
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from db.session import get_db
from core.dependencies import get_usuario
from core.wisphub.client import wisphub_client
from modules.whatsapp.service import ejecutar_recordatorios, send_template_message, SUSPENSION_HABILITADA, TEMPLATES
from modules.auditlog.service import log_accion
from core.dependencies import requerir_autenticado, requerir_admin

router = APIRouter()


class TestMessageRequest(BaseModel):
    phone: str
    template_name: str = "hello_world"


@router.post("/test")
async def test_mensaje(
    body: TestMessageRequest,
    usuario: dict = Depends(get_usuario),
):
    requerir_admin(usuario)
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
    requerir_autenticado(usuario)
    dias_key = body.dias_vencido if body.dias_vencido in TEMPLATES else 8 if body.dias_vencido > 8 else None
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


_FECHA_PAGO_FMTS = (
    "%d/%m/%Y %H:%M:%S", "%d/%m/%Y %H:%M", "%d/%m/%Y",
    "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d",
)


def _fecha_pago_date(f: dict):
    """Devuelve fecha_pago parseada; cae a fecha_vencimiento si no existe."""
    from datetime import date as _date
    fp_raw = (f.get("fecha_pago") or "").strip()
    if fp_raw:
        for fmt in _FECHA_PAGO_FMTS:
            try:
                from datetime import datetime
                return datetime.strptime(fp_raw[:19], fmt).date()
            except ValueError:
                continue
    fv_str = (f.get("fecha_vencimiento") or "")[:10]
    if fv_str:
        try:
            return _date.fromisoformat(fv_str)
        except ValueError:
            pass
    return None


@router.get("/resumen")
async def resumen_recordatorios(usuario: dict = Depends(get_usuario)):
    requerir_autenticado(usuario)
    from datetime import date
    from modules.finanzas.service import get_alertas_cobranza

    # Usamos la misma fuente que las tarjetas de cobranza para garantizar
    # que los conteos coincidan exactamente entre el dashboard y el modal.
    alertas = await get_alertas_cobranza()

    conteos = {0: 0, 1: 0, 2: 0, 3: 0, "cortado": 0, 7: 0}
    for grupo in ("hoy", "dia_1", "dia_2", "dia_3", "mas_de_3", "recoleccion"):
        for item in alertas[grupo]["items"]:
            d = item["dias_vencido"]
            if d <= 3:
                conteos[d] += 1
            elif d <= 7:
                conteos["cortado"] += 1
            else:
                conteos[7] += 1

    return {
        "fecha": date.today().isoformat(),
        "suspension_habilitada": SUSPENSION_HABILITADA,
        "resumen": [
            {"dia": 0, "label": "Vencen hoy",           "plantilla": "telnet_recordatorio_pago",  "count": conteos[0]},
            {"dia": 1, "label": "1 día vencido",         "plantilla": "telnet_aviso_vencido",      "count": conteos[1]},
            {"dia": 2, "label": "2 días vencido",        "plantilla": "telnet_aviso_vencido",      "count": conteos[2]},
            {"dia": 3, "label": "3 días vencido",        "plantilla": "telnet_aviso_vencido",      "count": conteos[3]},
            {"dia": 4, "label": "Servicio cortado",      "plantilla": "telnet_servicio_cortado",   "count": conteos["cortado"]},
            {"dia": 7, "label": "Recolección de equipo", "plantilla": "telnet_recoleccion_equipo", "count": conteos[7]},
        ],
        "total": sum(conteos.values()),
    }


@router.post("/ejecutar-recordatorios")
async def ejecutar(
    db: AsyncSession = Depends(get_db),
    usuario: dict = Depends(get_usuario),
):
    try:
        facturas_data = await wisphub_client.get_all("/api/facturas/")
        clientes_data = await wisphub_client.get_all("/api/clientes/")
        clientes_map = _build_clientes_map(clientes_data)

        facturas = []
        for f in facturas_data.get("results", []):
            if f.get("estado") != "Pendiente de Pago":
                continue
            _enrich_factura(f, clientes_map)
            facturas.append(f)

        resultado = await ejecutar_recordatorios(facturas)

        suspendidos_lista = [
            d for d in resultado["detalle"] if d.get("suspendido")
        ]
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
            datos_extra={
                "detalle": resultado["detalle"],
                "suspendidos": [
                    {"nombre": d["nombre"], "id_servicio": d.get("id_servicio"), "dias": d["dias"]}
                    for d in suspendidos_lista
                ],
            },
        )
        return resultado

    except Exception as exc:
        await log_accion(
            db=db,
            usuario=usuario,
            accion="WHATSAPP_RECORDATORIOS",
            modulo="whatsapp",
            entidad="recordatorios",
            descripcion=f"EXCEPCION: {exc}",
        )
        raise
