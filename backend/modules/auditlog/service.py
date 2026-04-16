import json
from datetime import datetime, date
from typing import Optional
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from modules.auditlog.models import AuditLog


async def log_accion(
    db: AsyncSession,
    usuario: dict,
    accion: str,
    modulo: str,
    entidad: str,
    descripcion: str,
    entidad_id: str | None = None,
    datos_extra: dict | None = None,
) -> None:
    """Registra una acción en el log de auditoría. Nunca lanza excepciones."""
    try:
        entry = AuditLog(
            usuario_id=usuario.get("id"),
            usuario_nombre=usuario.get("nombre") or "Sin identificar",
            accion=accion,
            modulo=modulo,
            entidad=entidad,
            entidad_id=entidad_id,
            descripcion=descripcion,
            datos_extra=json.dumps(datos_extra, ensure_ascii=False, default=str) if datos_extra else None,
        )
        db.add(entry)
        await db.commit()
    except Exception as exc:
        print(f"[AUDIT LOG ERROR]: {exc}")


async def get_audit_logs(
    db: AsyncSession,
    page: int = 1,
    page_size: int = 50,
    modulo: Optional[str] = None,
    accion: Optional[str] = None,
    usuario_id: Optional[int] = None,
    search: Optional[str] = None,
    fecha_desde: Optional[str] = None,
    fecha_hasta: Optional[str] = None,
) -> dict:
    stmt = select(AuditLog).order_by(AuditLog.created_at.desc())

    if modulo:
        stmt = stmt.where(AuditLog.modulo == modulo)
    if accion:
        stmt = stmt.where(AuditLog.accion == accion)
    if usuario_id is not None:
        stmt = stmt.where(AuditLog.usuario_id == usuario_id)
    if search:
        pattern = f"%{search}%"
        stmt = stmt.where(
            AuditLog.descripcion.like(pattern) | AuditLog.usuario_nombre.like(pattern)
        )
    if fecha_desde:
        stmt = stmt.where(AuditLog.created_at >= datetime.fromisoformat(fecha_desde))
    if fecha_hasta:
        hasta = datetime.fromisoformat(fecha_hasta)
        hasta = hasta.replace(hour=23, minute=59, second=59)
        stmt = stmt.where(AuditLog.created_at <= hasta)

    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = (await db.execute(count_stmt)).scalar() or 0

    stmt = stmt.offset((page - 1) * page_size).limit(page_size)
    logs = (await db.execute(stmt)).scalars().all()

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "items": [
            {
                "id": log.id,
                "usuario_id": log.usuario_id,
                "usuario_nombre": log.usuario_nombre,
                "accion": log.accion,
                "modulo": log.modulo,
                "entidad": log.entidad,
                "entidad_id": log.entidad_id,
                "descripcion": log.descripcion,
                "datos_extra": log.datos_extra,
                "created_at": log.created_at.isoformat(),
            }
            for log in logs
        ],
    }


async def get_audit_modulos(db: AsyncSession) -> list[str]:
    """Devuelve la lista de módulos únicos registrados."""
    result = await db.execute(
        select(AuditLog.modulo).distinct().order_by(AuditLog.modulo)
    )
    return [r[0] for r in result.all()]


async def get_audit_usuarios(db: AsyncSession) -> list[dict]:
    """Devuelve usuarios únicos que han realizado acciones."""
    result = await db.execute(
        select(AuditLog.usuario_id, AuditLog.usuario_nombre)
        .distinct(AuditLog.usuario_id)
        .order_by(AuditLog.usuario_nombre)
    )
    return [{"id": r[0], "nombre": r[1]} for r in result.all()]
