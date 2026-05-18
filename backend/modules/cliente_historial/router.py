from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from core.dependencies import get_usuario, requerir_autenticado
from db.session import get_db
from modules.cliente_historial.schemas import HistorialListResponse
from modules.cliente_historial.service import get_historial_cliente

router = APIRouter()


@router.get("/{id_servicio}/historial", response_model=HistorialListResponse)
async def historial_cliente(
    id_servicio: int,
    limit: int = Query(200, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    usuario: dict = Depends(get_usuario),
):
    requerir_autenticado(usuario)
    return await get_historial_cliente(db, id_servicio, limit=limit, offset=offset)
