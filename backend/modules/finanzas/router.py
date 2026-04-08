from fastapi import APIRouter, Query, Depends, Body
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from db.session import get_db
from modules.finanzas.service import (
    get_cobros_semana, get_cobros_dia, toggle_verificacion,
    ejecutar_flujo_cobranza, get_log_cobranza, registrar_pago, get_pagos_dia,
    get_alertas_cobranza, pagar_factura_wisphub, get_recoleccion,
    guardar_estado_equipo,
)

router = APIRouter()


@router.get("/cobros-semana")
async def cobros_semana(fecha_inicio: Optional[str] = Query(None)):
    return await get_cobros_semana(fecha_inicio)


@router.get("/cobros-dia")
async def cobros_dia(fecha: Optional[str] = Query(None), db: AsyncSession = Depends(get_db)):
    return await get_cobros_dia(fecha, db)


@router.patch("/cobros-dia/{id_factura}/verificar")
async def verificar_pago(id_factura: int, notas: Optional[str] = Query(None), db: AsyncSession = Depends(get_db)):
    return await toggle_verificacion(id_factura, notas, db)


@router.post("/ejecutar-cobranza")
async def ejecutar_cobranza(db: AsyncSession = Depends(get_db)):
    return await ejecutar_flujo_cobranza(db)


@router.get("/alertas-cobranza")
async def alertas_cobranza():
    return await get_alertas_cobranza()


@router.get("/log-cobranza")
async def log_cobranza(fecha: Optional[str] = Query(None), db: AsyncSession = Depends(get_db)):
    return await get_log_cobranza(fecha, db)


@router.get("/pagos")
async def pagos_dia(fecha: Optional[str] = Query(None), db: AsyncSession = Depends(get_db)):
    return await get_pagos_dia(fecha, db)


@router.post("/pagos")
async def crear_pago(data: dict = Body(...), db: AsyncSession = Depends(get_db)):
    return await registrar_pago(data, db)

@router.post("/registrar-pago/{id_factura}")
async def registrar_pago_wisphub(id_factura: int, data: dict = Body(...)):
    return await pagar_factura_wisphub(id_factura, data)

@router.get("/recoleccion")
async def recoleccion(db: AsyncSession = Depends(get_db)):
    return await get_recoleccion(db)

@router.post("/recoleccion/{id_servicio}/estado-equipo")
async def estado_equipo(id_servicio: int, data: dict = Body(...), db: AsyncSession = Depends(get_db)):
    return await guardar_estado_equipo(id_servicio, data, db)