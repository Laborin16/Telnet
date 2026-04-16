from typing import Optional
from fastapi import Header
from core.wisphub.client import wisphub_client


async def get_wisphub_client():
    return wisphub_client


async def get_usuario(authorization: Optional[str] = Header(None)) -> dict:
    """
    Extrae la identidad del usuario desde el JWT Bearer token.
    Si no hay token o es inválido devuelve un usuario anónimo (no falla la petición).
    """
    if authorization and authorization.startswith("Bearer "):
        try:
            import jwt
            from core.config import settings
            payload = jwt.decode(
                authorization[7:],
                settings.app_secret_key,
                algorithms=["HS256"],
            )
            return {
                "id": payload.get("wisphub_id"),
                "nombre": payload.get("nombre") or "Sin identificar",
            }
        except Exception:
            pass
    return {"id": None, "nombre": "Sin identificar"}