from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from db.session import get_db
from modules.auditlog.service import get_audit_logs, get_audit_modulos, get_audit_usuarios

router = APIRouter()


@router.get("/logs")
async def audit_logs(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    modulo: Optional[str] = Query(None),
    accion: Optional[str] = Query(None),
    usuario_id: Optional[int] = Query(None),
    search: Optional[str] = Query(None),
    fecha_desde: Optional[str] = Query(None),
    fecha_hasta: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    return await get_audit_logs(
        db, page, page_size, modulo, accion, usuario_id, search, fecha_desde, fecha_hasta
    )


@router.get("/modulos")
async def audit_modulos(db: AsyncSession = Depends(get_db)):
    return await get_audit_modulos(db)


@router.get("/usuarios")
async def audit_usuarios(db: AsyncSession = Depends(get_db)):
    return await get_audit_usuarios(db)
