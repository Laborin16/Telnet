from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from core.dependencies import get_usuario
from db.session import get_db
from modules.reportes import service
from modules.reportes.enums import EstadoTarea, PrioridadTarea, TipoTarea
from modules.reportes.schemas import (
    AsignarTecnico,
    EliminarSuscripcionPush,
    SuscripcionPushCreate,
    TareaCreate,
    TareaEventoResponse,
    TareaFotoResponse,
    TareaResponse,
    TareaUpdate,
    TransicionEstado,
)
from modules.reportes.state_machine import estados_siguientes

router = APIRouter()


@router.post("/tareas", response_model=TareaResponse, status_code=201)
async def crear_tarea(
    datos: TareaCreate,
    db: AsyncSession = Depends(get_db),
    usuario: dict = Depends(get_usuario),
):
    _requerir_admin(usuario)
    try:
        tarea = await service.crear_tarea(datos, usuario, db)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return tarea


@router.get("/tareas", response_model=list[TareaResponse])
async def listar_tareas(
    estado: EstadoTarea | None = Query(None),
    tipo: TipoTarea | None = Query(None),
    prioridad: PrioridadTarea | None = Query(None),
    tecnico_id: int | None = Query(None),
    db: AsyncSession = Depends(get_db),
    usuario: dict = Depends(get_usuario),
):
    _requerir_autenticado(usuario)
    return await service.listar_tareas(usuario, db, estado=estado, tipo=tipo, prioridad=prioridad, tecnico_id=tecnico_id)


@router.get("/tareas/{tarea_id}", response_model=TareaResponse)
async def obtener_tarea(
    tarea_id: int,
    db: AsyncSession = Depends(get_db),
    usuario: dict = Depends(get_usuario),
):
    _requerir_autenticado(usuario)
    try:
        return await service.obtener_tarea(tarea_id, usuario, db)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))


@router.patch("/tareas/{tarea_id}", response_model=TareaResponse)
async def actualizar_tarea(
    tarea_id: int,
    datos: TareaUpdate,
    db: AsyncSession = Depends(get_db),
    usuario: dict = Depends(get_usuario),
):
    _requerir_admin(usuario)
    try:
        return await service.actualizar_tarea(tarea_id, datos, usuario, db)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))


@router.patch("/tareas/{tarea_id}/asignar", response_model=TareaResponse)
async def asignar_tecnico(
    tarea_id: int,
    datos: AsignarTecnico,
    db: AsyncSession = Depends(get_db),
    usuario: dict = Depends(get_usuario),
):
    _requerir_admin(usuario)
    try:
        return await service.asignar_tecnico(tarea_id, datos, usuario, db)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/tareas/{tarea_id}/transicion", response_model=TareaResponse)
async def transicionar_estado(
    tarea_id: int,
    datos: TransicionEstado,
    db: AsyncSession = Depends(get_db),
    usuario: dict = Depends(get_usuario),
):
    _requerir_autenticado(usuario)
    try:
        return await service.transicionar_estado(tarea_id, datos, usuario, db)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))


@router.get("/tareas/{tarea_id}/transiciones", response_model=list[str])
async def obtener_transiciones_validas(
    tarea_id: int,
    db: AsyncSession = Depends(get_db),
    usuario: dict = Depends(get_usuario),
):
    _requerir_autenticado(usuario)
    try:
        tarea = await service.obtener_tarea(tarea_id, usuario, db)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    return [e.value for e in estados_siguientes(EstadoTarea(tarea.estado))]


@router.get("/tareas/{tarea_id}/eventos", response_model=list[TareaEventoResponse])
async def listar_eventos(
    tarea_id: int,
    db: AsyncSession = Depends(get_db),
    usuario: dict = Depends(get_usuario),
):
    _requerir_autenticado(usuario)
    try:
        return await service.listar_eventos(tarea_id, usuario, db)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))


@router.post("/tareas/{tarea_id}/fotos", response_model=TareaFotoResponse, status_code=201)
async def subir_foto(
    tarea_id: int,
    archivo: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    usuario: dict = Depends(get_usuario),
):
    _requerir_autenticado(usuario)
    contenido = await archivo.read()
    if len(contenido) > 10 * 1024 * 1024:  # 10 MB
        raise HTTPException(status_code=413, detail="El archivo supera el límite de 10 MB")
    try:
        return await service.subir_foto(tarea_id, archivo.filename or "foto.jpg", contenido, usuario, db)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))


@router.get("/tareas/{tarea_id}/fotos", response_model=list[TareaFotoResponse])
async def listar_fotos(
    tarea_id: int,
    db: AsyncSession = Depends(get_db),
    usuario: dict = Depends(get_usuario),
):
    _requerir_autenticado(usuario)
    try:
        return await service.listar_fotos(tarea_id, usuario, db)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))


@router.post("/push/suscribir", status_code=201)
async def registrar_push(
    datos: SuscripcionPushCreate,
    db: AsyncSession = Depends(get_db),
    usuario: dict = Depends(get_usuario),
):
    _requerir_autenticado(usuario)
    await service.registrar_suscripcion(datos, usuario, db)
    return {"ok": True}


@router.delete("/push/suscribir", status_code=204)
async def eliminar_push(
    datos: EliminarSuscripcionPush,
    db: AsyncSession = Depends(get_db),
    usuario: dict = Depends(get_usuario),
):
    _requerir_autenticado(usuario)
    await service.eliminar_suscripcion(datos.endpoint, usuario, db)


# ── Helpers de autorización ───────────────────────────────────────────────────

def _requerir_autenticado(usuario: dict) -> None:
    if usuario.get("id") is None:
        raise HTTPException(status_code=401, detail="Autenticación requerida")


def _requerir_admin(usuario: dict) -> None:
    _requerir_autenticado(usuario)
    if not usuario.get("es_admin"):
        raise HTTPException(status_code=403, detail="Solo supervisores pueden realizar esta acción")
