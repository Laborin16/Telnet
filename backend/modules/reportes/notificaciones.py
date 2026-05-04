import asyncio
import base64
import json
import logging
from datetime import datetime
from typing import Any

from cryptography.hazmat.primitives.serialization import (
    Encoding,
    NoEncryption,
    PrivateFormat,
    load_der_private_key,
)
from pywebpush import WebPushException, webpush
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings
from modules.reportes.models import SuscripcionPush

logger = logging.getLogger(__name__)

_pem_cache: str | None = None
_alertas_sla_enviadas: set[int] = set()  # IDs de tareas ya notificadas (en memoria)


def _get_private_key_pem() -> str | None:
    global _pem_cache
    if not settings.vapid_private_key:
        return None
    if _pem_cache is None:
        raw = base64.urlsafe_b64decode(settings.vapid_private_key + "==")
        key = load_der_private_key(raw, password=None)
        _pem_cache = key.private_bytes(
            Encoding.PEM, PrivateFormat.TraditionalOpenSSL, NoEncryption()
        ).decode()
    return _pem_cache


def _send_one(endpoint: str, p256dh: str, auth: str, payload: str, pem: str) -> int:
    """Síncrono: devuelve el status code HTTP de la respuesta."""
    resp = webpush(
        subscription_info={"endpoint": endpoint, "keys": {"p256dh": p256dh, "auth": auth}},
        data=payload,
        vapid_private_key=pem,
        vapid_claims={"sub": settings.vapid_subject},
    )
    return resp.status_code if hasattr(resp, "status_code") else 201


async def enviar_push(
    usuario_id: int,
    titulo: str,
    cuerpo: str,
    db: AsyncSession,
    data: dict[str, Any] | None = None,
) -> None:
    pem = _get_private_key_pem()
    if not pem:
        return

    resultado = await db.execute(
        select(SuscripcionPush).where(SuscripcionPush.usuario_id == usuario_id)
    )
    suscripciones = list(resultado.scalars().all())
    if not suscripciones:
        return

    payload = json.dumps({"title": titulo, "body": cuerpo, "data": data or {}})
    expiradas: list[int] = []

    for sub in suscripciones:
        try:
            await asyncio.to_thread(_send_one, sub.endpoint, sub.p256dh, sub.auth, payload, pem)
        except WebPushException as e:
            if e.response is not None and e.response.status_code == 410:
                expiradas.append(sub.id)
            else:
                logger.warning("Push fallido para usuario %s: %s", usuario_id, e)
        except Exception as e:
            logger.warning("Error inesperado en push para usuario %s: %s", usuario_id, e)

    for sub_id in expiradas:
        expired = await db.get(SuscripcionPush, sub_id)
        if expired:
            await db.delete(expired)
    if expiradas:
        await db.commit()


async def job_alertas_sla() -> None:
    """Corre cada 15 min: notifica al supervisor por cada tarea con SLA vencido."""
    from sqlalchemy import select
    from db.session import AsyncSessionLocal
    from modules.reportes.models import Tarea
    from modules.reportes.enums import EstadoTarea

    estados_activos = [
        EstadoTarea.PENDIENTE,
        EstadoTarea.ASIGNADO,
        EstadoTarea.EN_RUTA,
        EstadoTarea.EN_EJECUCION,
        EstadoTarea.BLOQUEADO,
    ]

    try:
        async with AsyncSessionLocal() as db:
            resultado = await db.execute(
                select(Tarea).where(
                    Tarea.fecha_limite < datetime.now(),
                    Tarea.estado.in_([e.value for e in estados_activos]),
                )
            )
            tareas_vencidas = list(resultado.scalars().all())

            for tarea in tareas_vencidas:
                if tarea.id in _alertas_sla_enviadas:
                    continue
                await enviar_push(
                    usuario_id=tarea.supervisor_id,
                    titulo="SLA vencido",
                    cuerpo=f"{tarea.tipo.replace('_', ' ').title()} · Servicio {tarea.id_servicio}",
                    db=db,
                    data={"tarea_id": tarea.id},
                )
                _alertas_sla_enviadas.add(tarea.id)
    except Exception as e:
        logger.error("Error en job_alertas_sla: %s", e)
