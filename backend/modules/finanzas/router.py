from fastapi import APIRouter, Query, Depends
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from db.session import get_db
from modules.finanzas.service import get_cobros_semana, get_cobros_dia, toggle_verificacion

router = APIRouter()


@router.get("/cobros-semana")
async def cobros_semana(fecha_inicio: Optional[str] = Query(None, description="YYYY-MM-DD de cualquier día de la semana deseada")):
    return await get_cobros_semana(fecha_inicio)


@router.get("/cobros-dia")
async def cobros_dia(
    fecha: Optional[str] = Query(None, description="YYYY-MM-DD del día a consultar"),
    db: AsyncSession = Depends(get_db),
):
    return await get_cobros_dia(fecha, db)


@router.patch("/cobros-dia/{id_factura}/verificar")
async def verificar_pago(
    id_factura: int,
    notas: Optional[str] = Query(None, description="Observaciones del pago"),
    db: AsyncSession = Depends(get_db),
):
    return await toggle_verificacion(id_factura, notas, db)
