import httpx
from core.config import settings

GRAPH_URL = "https://graph.facebook.com/v19.0"


async def send_test_message(to_phone: str) -> dict:
    """Send hello_world template to a single phone number."""
    url = f"{GRAPH_URL}/{settings.whatsapp_phone_number_id}/messages"
    headers = {
        "Authorization": f"Bearer {settings.whatsapp_token}",
        "Content-Type": "application/json",
    }
    payload = {
        "messaging_product": "whatsapp",
        "to": to_phone,
        "type": "template",
        "template": {
            "name": "hello_world",
            "language": {"code": "en_US"},
        },
    }
    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.post(url, json=payload, headers=headers)
        return {"status_code": response.status_code, "body": response.json()}
