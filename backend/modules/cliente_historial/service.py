import json
from datetime import datetime

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from modules.cliente_historial.enums import TipoEvento
from modules.cliente_historial.models import ClienteHistorial


async def registrar_evento(
    db: AsyncSession,
    *,
    id_servicio: int | None,
    tipo_evento: TipoEvento,
    titulo: str,
    usuario: dict | None = None,
    descripcion: str | None = None,
    datos_extra: dict | None = None,
    tarea_id: int | None = None,
    pago_id: int | None = None,
) -> None:
    """Registra un evento en el historial del cliente. Nunca lanza excepciones.

    Si `id_servicio` es None (ej. tarea de tipo INSTALACION antes de vincular
    el servicio en WispHub) el evento se descarta silenciosamente — el
    historial solo tiene sentido por cliente.
    """
    if id_servicio is None:
        return
    try:
        entry = ClienteHistorial(
            id_servicio=id_servicio,
            tipo_evento=tipo_evento.value,
            fecha=datetime.now(),
            usuario_id=(usuario or {}).get("id"),
            usuario_nombre=(usuario or {}).get("nombre") or "Sistema",
            titulo=titulo[:200],
            descripcion=descripcion[:1000] if descripcion else None,
            datos_extra=json.dumps(datos_extra, ensure_ascii=False, default=str) if datos_extra else None,
            tarea_id=tarea_id,
            pago_id=pago_id,
        )
        db.add(entry)
        # No commit aquí: el commit lo hace el caller. Así el evento queda
        # atado a la misma transacción que la acción que lo originó.
    except Exception as exc:
        print(f"[CLIENTE_HISTORIAL ERROR]: {exc}")


async def get_historial_cliente(
    db: AsyncSession,
    id_servicio: int,
    *,
    limit: int = 200,
    offset: int = 0,
) -> dict:
    """Devuelve los eventos del cliente ordenados por fecha desc."""
    stmt = (
        select(ClienteHistorial)
        .where(ClienteHistorial.id_servicio == id_servicio)
        .order_by(ClienteHistorial.fecha.desc())
    )

    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = (await db.execute(count_stmt)).scalar() or 0

    stmt = stmt.offset(offset).limit(limit)
    rows = (await db.execute(stmt)).scalars().all()

    items = []
    for r in rows:
        items.append({
            "id": r.id,
            "id_servicio": r.id_servicio,
            "tipo_evento": r.tipo_evento,
            "fecha": r.fecha,
            "usuario_id": r.usuario_id,
            "usuario_nombre": r.usuario_nombre,
            "titulo": r.titulo,
            "descripcion": r.descripcion,
            "datos_extra": json.loads(r.datos_extra) if r.datos_extra else None,
            "tarea_id": r.tarea_id,
            "pago_id": r.pago_id,
        })

    return {"total": total, "items": items}
