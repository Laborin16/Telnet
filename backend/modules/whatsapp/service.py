import asyncio
from datetime import date, datetime
import httpx
from core.config import settings

GRAPH_URL = f"https://graph.facebook.com/v20.0/{settings.whatsapp_phone_number_id}/messages"

HEADERS = {
    "Authorization": f"Bearer {settings.whatsapp_token}",
    "Content-Type": "application/json",
}

# Cambiar a True para habilitar la suspensión automática en producción
SUSPENSION_HABILITADA = True

TEMPLATES = {
    0: "telnet_vencimiento_hoy_",
    1: "telnet_pago_vencido",
    2: "telnet_pago_vencido",
    3: "telnet_advertencia_corte",
    4: "telnet_servicio_suspendido",
}
IDIOMA_POR_PLANTILLA = {
    "telnet_vencimiento_hoy_": "es_MX",
    "telnet_pago_vencido": "es_MX",
    "telnet_advertencia_corte": "es_MX",
    "telnet_servicio_suspendido": "es_MX",
}


_FECHA_PAGO_FMTS = (
    "%d/%m/%Y %H:%M:%S",
    "%d/%m/%Y %H:%M",
    "%d/%m/%Y",
    "%Y-%m-%dT%H:%M:%S",
    "%Y-%m-%d",
)


def _parse_fecha_referencia(f: dict) -> date | None:
    """Igual que la tabla de cobranza: usa fecha_pago; cae a fecha_vencimiento si no existe."""
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


_NO_PARAMS_TEMPLATES = {"hello_world"}
_TEMPLATE_LANG = {**IDIOMA_POR_PLANTILLA, "hello_world": "en_US"}


def _build_payload(phone: str, template_name: str, nombre: str, monto: float) -> dict:
    phone_clean = phone.replace("+", "").replace(" ", "").replace("-", "")
    if not phone_clean.startswith("52"):
        phone_clean = "52" + phone_clean
    # Números móviles mexicanos requieren "521" (13 dígitos), no "52" (12 dígitos)
    if phone_clean.startswith("52") and not phone_clean.startswith("521") and len(phone_clean) == 12:
        phone_clean = "521" + phone_clean[2:]

    template_obj: dict = {
        "name": template_name,
        "language": {"code": _TEMPLATE_LANG.get(template_name, "es_MX")},
    }
    if template_name not in _NO_PARAMS_TEMPLATES:
        template_obj["components"] = [
            {
                "type": "body",
                "parameters": [
                    {"type": "text", "parameter_name": "nombre", "text": nombre},
                    {"type": "text", "parameter_name": "monto", "text": f"${monto:.2f}"},
                ],
            }
        ]

    return {
        "messaging_product": "whatsapp",
        "to": phone_clean,
        "type": "template",
        "template": template_obj,
    }


async def send_template_message(phone: str, template_name: str, nombre: str, monto: float) -> dict:
    payload = _build_payload(phone, template_name, nombre, monto)
    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.post(GRAPH_URL, headers=HEADERS, json=payload)
        return {"status_code": response.status_code, "body": response.json()}


async def ejecutar_recordatorios(facturas: list[dict]) -> dict:
    from core.wisphub.client import wisphub_client

    today = date.today()
    resultados = {"enviados": 0, "errores": 0, "suspendidos": 0, "detalle": []}

    async def procesar(f: dict):
        fecha_ref = _parse_fecha_referencia(f)
        if fecha_ref is None:
            return

        dias = (today - fecha_ref).days
        if dias < 0:
            return

        # Normalizar: días 4+ usan la plantilla de suspendido
        dias_template = dias if dias in TEMPLATES else 4 if dias > 4 else None
        if dias_template is None:
            return

        cliente = f.get("cliente") or {}
        nombre = cliente.get("nombre", "Cliente")
        telefono = (cliente.get("telefono") or "").split(",")[0].strip()
        monto = float(f.get("total") or 0)

        if not telefono:
            resultados["detalle"].append({
                "nombre": nombre,
                "dias": dias,
                "estado": "sin_telefono",
            })
            return

        # Día 4+: suspender primero (desactivado provisionalmente para pruebas)
        if SUSPENSION_HABILITADA and dias >= 4:
            id_servicio = None
            for art in f.get("articulos", []):
                id_servicio = (art.get("servicio") or {}).get("id_servicio")
                if id_servicio:
                    break
            if id_servicio:
                try:
                    await wisphub_client.post(
                        "/api/clientes/desactivar/",
                        payload={"servicios": [id_servicio]}
                    )
                    resultados["suspendidos"] += 1
                except Exception:
                    pass

        template = TEMPLATES[dias_template]
        try:
            result = await send_template_message(telefono, template, nombre, monto)
            if result["status_code"] in (200, 201):
                resultados["enviados"] += 1
                wa_id = (result["body"].get("contacts") or [{}])[0].get("wa_id", "")
                resultados["detalle"].append({
                    "nombre": nombre,
                    "dias": dias,
                    "estado": "enviado",
                    "template": template,
                    "wa_id": wa_id,
                })
            else:
                resultados["errores"] += 1
                resultados["detalle"].append({
                    "nombre": nombre,
                    "dias": dias,
                    "estado": "error",
                    "error": str(result["body"]),
                })
        except Exception as exc:
            resultados["errores"] += 1
            resultados["detalle"].append({
                "nombre": nombre,
                "dias": dias,
                "estado": "error",
                "error": f"Excepción: {exc}",
            })

    tareas = [procesar(f) for f in facturas]
    await asyncio.gather(*tareas, return_exceptions=True)
    return resultados