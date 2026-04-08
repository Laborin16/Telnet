import httpx
from core.config import settings

GRAPH_URL = "https://graph.facebook.com/v19.0"

_TEMPLATES_RECORDATORIO = {
    1: "recordatorio_pago_dia1",
    2: "recordatorio_pago_dia2",
    3: "aviso_corte_preventivo",
}
_TEMPLATE_SUSPENSION = "notificacion_suspension"


async def _send_template(to_phone: str, template_name: str, components: list, language: str = "es_MX") -> dict:
    url = f"{GRAPH_URL}/{settings.whatsapp_phone_number_id}/messages"
    headers = {"Authorization": f"Bearer {settings.whatsapp_token}", "Content-Type": "application/json"}
    payload = {
        "messaging_product": "whatsapp",
        "to": to_phone,
        "type": "template",
        "template": {"name": template_name, "language": {"code": language}, "components": components},
    }
    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.post(url, json=payload, headers=headers)
        return {"status_code": response.status_code, "body": response.json()}


async def send_test_message(to_phone: str) -> dict:
    """Envía hello_world template para pruebas de conectividad."""
    return await _send_template(to_phone, "hello_world", [], language="en_US")


async def send_recordatorio_dia(to_phone: str, nombre: str, dia: int, fecha_vencimiento: str, monto: float) -> dict:
    """Días 1-3: recordatorio de pago con nombre, monto y fecha de vencimiento."""
    components = [{"type": "body", "parameters": [
        {"type": "text", "text": nombre},
        {"type": "text", "text": f"${monto:,.2f}"},
        {"type": "text", "text": fecha_vencimiento},
    ]}]
    return await _send_template(to_phone, _TEMPLATES_RECORDATORIO[dia], components)


async def send_notificacion_corte(to_phone: str, nombre: str) -> dict:
    """Día 4: notificación de suspensión de servicio."""
    components = [{"type": "body", "parameters": [{"type": "text", "text": nombre}]}]
    return await _send_template(to_phone, _TEMPLATE_SUSPENSION, components)
