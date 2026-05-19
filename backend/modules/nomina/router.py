from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.ext.asyncio import AsyncSession

from db.session import get_db
from core.dependencies import get_usuario, requerir_admin
from modules.auditlog.service import log_accion
from modules.nomina import service
from modules.nomina.pdf import generar_recibo_individual_pdf, generar_recibos_periodo_pdf
from modules.nomina.schemas import (
    BonoOverrideRequest, DiferirCuotaRequest,
    DashboardNomina, IncidenciaCreate, IncidenciaResponse, IncidenciaUpdate,
    PeriodoCreate, PeriodoDetalle, PeriodoResumen,
    PrestamoCreate, PrestamoResponse, PrestamoUpdate,
    RegistroResponse, RegistroUpdate,
)

router = APIRouter()


# ─── Periodos ───────────────────────────────────────────────────────────────

@router.get("/periodos", response_model=list[PeriodoResumen])
async def listar_periodos(
    db: AsyncSession = Depends(get_db),
    usuario: dict = Depends(get_usuario),
):
    requerir_admin(usuario)
    return await service.listar_periodos(db)


@router.post("/periodos", response_model=PeriodoDetalle)
async def crear_periodo(
    payload: PeriodoCreate,
    db: AsyncSession = Depends(get_db),
    usuario: dict = Depends(get_usuario),
):
    requerir_admin(usuario)
    periodo = await service.crear_periodo(db, payload)
    await log_accion(
        db=db, usuario=usuario, accion="NOMINA_PERIODO_CREAR", modulo="nomina",
        entidad="periodo", entidad_id=str(periodo.id),
        descripcion=f"Período {periodo.fecha_inicio} → {periodo.fecha_fin}",
    )
    return await service.get_periodo_detalle(db, periodo.id)


@router.get("/periodos/{periodo_id}", response_model=PeriodoDetalle)
async def detalle_periodo(
    periodo_id: int,
    db: AsyncSession = Depends(get_db),
    usuario: dict = Depends(get_usuario),
):
    requerir_admin(usuario)
    try:
        return await service.get_periodo_detalle(db, periodo_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/periodos/{periodo_id}/cerrar", response_model=PeriodoDetalle)
async def cerrar_periodo(
    periodo_id: int,
    db: AsyncSession = Depends(get_db),
    usuario: dict = Depends(get_usuario),
):
    requerir_admin(usuario)
    try:
        await service.cerrar_periodo(db, periodo_id, usuario)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    await log_accion(
        db=db, usuario=usuario, accion="NOMINA_PERIODO_CERRAR", modulo="nomina",
        entidad="periodo", entidad_id=str(periodo_id),
        descripcion=f"Período {periodo_id} cerrado",
    )
    return await service.get_periodo_detalle(db, periodo_id)


@router.post("/periodos/{periodo_id}/reabrir", response_model=PeriodoDetalle)
async def reabrir_periodo(
    periodo_id: int,
    db: AsyncSession = Depends(get_db),
    usuario: dict = Depends(get_usuario),
):
    requerir_admin(usuario)
    try:
        await service.reabrir_periodo(db, periodo_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    await log_accion(
        db=db, usuario=usuario, accion="NOMINA_PERIODO_REABRIR", modulo="nomina",
        entidad="periodo", entidad_id=str(periodo_id),
        descripcion=f"Período {periodo_id} reabierto",
    )
    return await service.get_periodo_detalle(db, periodo_id)


# ─── Registros ──────────────────────────────────────────────────────────────

@router.patch("/registros/{registro_id}", response_model=RegistroResponse)
async def actualizar_registro(
    registro_id: int,
    payload: RegistroUpdate,
    db: AsyncSession = Depends(get_db),
    usuario: dict = Depends(get_usuario),
):
    requerir_admin(usuario)
    try:
        return await service.update_registro(db, registro_id, payload)
    except PermissionError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/registros/{registro_id}/bono-override", response_model=RegistroResponse)
async def set_bono_override(
    registro_id: int,
    payload: BonoOverrideRequest,
    db: AsyncSession = Depends(get_db),
    usuario: dict = Depends(get_usuario),
):
    requerir_admin(usuario)
    try:
        return await service.set_bono_override(db, registro_id, payload.override)
    except PermissionError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/registros/{registro_id}/recibo.pdf")
async def recibo_individual_pdf(
    registro_id: int,
    db: AsyncSession = Depends(get_db),
    usuario: dict = Depends(get_usuario),
):
    requerir_admin(usuario)
    try:
        registro = await service.get_registro_response(db, registro_id)
        periodo = await service.get_periodo_detalle(db, registro.periodo_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    pdf_bytes = generar_recibo_individual_pdf(registro, periodo)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{_nombre_pdf(periodo)}.pdf"'},
    )


@router.get("/periodos/{periodo_id}/recibos.pdf")
async def recibos_periodo_pdf(
    periodo_id: int,
    db: AsyncSession = Depends(get_db),
    usuario: dict = Depends(get_usuario),
):
    requerir_admin(usuario)
    try:
        detalle = await service.get_periodo_detalle(db, periodo_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    pdf_bytes = generar_recibos_periodo_pdf(detalle)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{_nombre_pdf(detalle)}.pdf"'},
    )


def _nombre_pdf(periodo) -> str:
    """Nombre del archivo PDF de nómina: 'Nomina Semana NN DD-MM-YYYY a DD-MM-YYYY'."""
    inicio = periodo.fecha_inicio
    fin = periodo.fecha_fin
    semana = inicio.isocalendar()[1]
    return f"Nomina Semana {semana:02d} {inicio.strftime('%d-%m-%Y')} a {fin.strftime('%d-%m-%Y')}"


# ─── Incidencias ────────────────────────────────────────────────────────────

@router.post("/registros/{registro_id}/incidencias", response_model=IncidenciaResponse)
async def crear_incidencia(
    registro_id: int,
    payload: IncidenciaCreate,
    db: AsyncSession = Depends(get_db),
    usuario: dict = Depends(get_usuario),
):
    requerir_admin(usuario)
    try:
        return await service.crear_incidencia(db, registro_id, payload)
    except PermissionError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.patch("/incidencias/{incidencia_id}", response_model=IncidenciaResponse)
async def actualizar_incidencia(
    incidencia_id: int,
    payload: IncidenciaUpdate,
    db: AsyncSession = Depends(get_db),
    usuario: dict = Depends(get_usuario),
):
    requerir_admin(usuario)
    try:
        return await service.actualizar_incidencia(db, incidencia_id, payload)
    except PermissionError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/incidencias/{incidencia_id}/diferir", response_model=IncidenciaResponse)
async def diferir_cuota(
    incidencia_id: int,
    payload: DiferirCuotaRequest,
    db: AsyncSession = Depends(get_db),
    usuario: dict = Depends(get_usuario),
):
    requerir_admin(usuario)
    try:
        return await service.diferir_cuota(db, incidencia_id, payload.diferida)
    except PermissionError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.delete("/incidencias/{incidencia_id}")
async def eliminar_incidencia(
    incidencia_id: int,
    db: AsyncSession = Depends(get_db),
    usuario: dict = Depends(get_usuario),
):
    requerir_admin(usuario)
    try:
        await service.eliminar_incidencia(db, incidencia_id)
    except PermissionError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return {"ok": True}


# ─── Préstamos ──────────────────────────────────────────────────────────────

@router.get("/prestamos", response_model=list[PrestamoResponse])
async def listar_prestamos(
    solo_activos: bool = False,
    db: AsyncSession = Depends(get_db),
    usuario: dict = Depends(get_usuario),
):
    requerir_admin(usuario)
    return await service.listar_prestamos(db, solo_activos=solo_activos)


@router.post("/prestamos", response_model=PrestamoResponse)
async def crear_prestamo(
    payload: PrestamoCreate,
    db: AsyncSession = Depends(get_db),
    usuario: dict = Depends(get_usuario),
):
    requerir_admin(usuario)
    try:
        p = await service.crear_prestamo(db, payload)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    await log_accion(
        db=db, usuario=usuario, accion="NOMINA_PRESTAMO_CREAR", modulo="nomina",
        entidad="prestamo", entidad_id=str(p.id),
        descripcion=f"Préstamo a {p.usuario_nombre}: {p.monto_total} en {p.cuotas_totales} cuotas",
    )
    return p


@router.patch("/prestamos/{prestamo_id}", response_model=PrestamoResponse)
async def actualizar_prestamo(
    prestamo_id: int,
    payload: PrestamoUpdate,
    db: AsyncSession = Depends(get_db),
    usuario: dict = Depends(get_usuario),
):
    requerir_admin(usuario)
    try:
        return await service.actualizar_prestamo(db, prestamo_id, payload)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.delete("/prestamos/{prestamo_id}")
async def cancelar_prestamo(
    prestamo_id: int,
    db: AsyncSession = Depends(get_db),
    usuario: dict = Depends(get_usuario),
):
    requerir_admin(usuario)
    try:
        await service.cancelar_prestamo(db, prestamo_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    await log_accion(
        db=db, usuario=usuario, accion="NOMINA_PRESTAMO_CANCELAR", modulo="nomina",
        entidad="prestamo", entidad_id=str(prestamo_id),
        descripcion=f"Préstamo {prestamo_id} cancelado",
    )
    return {"ok": True}


# ─── Dashboard ──────────────────────────────────────────────────────────────

@router.get("/dashboard", response_model=DashboardNomina)
async def dashboard(
    db: AsyncSession = Depends(get_db),
    usuario: dict = Depends(get_usuario),
):
    requerir_admin(usuario)
    return await service.get_dashboard(db)
