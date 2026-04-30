from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from modules.auth.models import Usuario
from modules.reportes.enums import EstadoTarea, PrioridadTarea, TipoTarea
from modules.reportes.models import Tarea, TareaEvento
from modules.reportes.schemas import AsignarTecnico, TareaCreate, TareaUpdate, TransicionEstado
from modules.reportes.state_machine import validar_transicion


async def crear_tarea(datos: TareaCreate, usuario: dict, db: AsyncSession) -> Tarea:
    estado_inicial = EstadoTarea.PENDIENTE
    fecha_asignada = None

    if datos.tecnico_id is not None:
        tecnico = await _verificar_tecnico(datos.tecnico_id, db)
        estado_inicial = EstadoTarea.ASIGNADO
        fecha_asignada = datetime.now()

    tarea = Tarea(
        id_servicio=datos.id_servicio,
        tipo=datos.tipo,
        prioridad=datos.prioridad,
        estado=estado_inicial,
        descripcion=datos.descripcion,
        tecnico_id=datos.tecnico_id,
        supervisor_id=usuario["id"],
        latitud=datos.latitud,
        longitud=datos.longitud,
        fecha_asignada=fecha_asignada,
    )
    db.add(tarea)
    await db.flush()

    db.add(TareaEvento(
        tarea_id=tarea.id,
        usuario_id=usuario["id"],
        usuario_nombre=usuario["nombre"],
        estado_anterior=None,
        estado_nuevo=estado_inicial,
    ))
    await db.commit()
    await db.refresh(tarea)
    return tarea


async def asignar_tecnico(tarea_id: int, datos: AsignarTecnico, usuario: dict, db: AsyncSession) -> Tarea:
    tarea = await _obtener_tarea_o_404(tarea_id, db)
    tecnico = await _verificar_tecnico(datos.tecnico_id, db)

    estado_anterior = EstadoTarea(tarea.estado)

    if tarea.estado == EstadoTarea.PENDIENTE:
        tarea.estado = EstadoTarea.ASIGNADO
        tarea.fecha_asignada = datetime.now()

    tarea.tecnico_id = datos.tecnico_id
    tarea.updated_at = datetime.now()

    db.add(TareaEvento(
        tarea_id=tarea.id,
        usuario_id=usuario["id"],
        usuario_nombre=usuario["nombre"],
        estado_anterior=estado_anterior,
        estado_nuevo=EstadoTarea(tarea.estado),
        comentario=f"Técnico asignado: {tecnico.nombre}",
    ))
    await db.commit()
    await db.refresh(tarea)
    return tarea


async def transicionar_estado(tarea_id: int, datos: TransicionEstado, usuario: dict, db: AsyncSession) -> Tarea:
    tarea = await _obtener_tarea_o_404(tarea_id, db)

    # Técnicos solo pueden transicionar sus propias tareas
    if not usuario.get("es_admin") and tarea.tecnico_id != usuario["id"]:
        raise PermissionError("No tienes permiso para modificar esta tarea")

    estado_actual = EstadoTarea(tarea.estado)
    estado_nuevo = datos.estado_nuevo

    # Impide llegar a ASIGNADO sin técnico (usar asignar_tecnico para eso)
    if estado_nuevo == EstadoTarea.ASIGNADO and tarea.tecnico_id is None:
        raise ValueError("La tarea no tiene técnico asignado. Usa el endpoint de asignación.")

    validar_transicion(estado_actual, estado_nuevo, datos.comentario)

    tarea.estado = estado_nuevo
    tarea.updated_at = datetime.now()

    if estado_nuevo == EstadoTarea.ASIGNADO and tarea.fecha_asignada is None:
        tarea.fecha_asignada = datetime.now()
    elif estado_nuevo == EstadoTarea.EN_EJECUCION and tarea.fecha_iniciada is None:
        tarea.fecha_iniciada = datetime.now()
    elif estado_nuevo == EstadoTarea.COMPLETADO:
        tarea.fecha_completada = datetime.now()

    db.add(TareaEvento(
        tarea_id=tarea.id,
        usuario_id=usuario["id"],
        usuario_nombre=usuario["nombre"],
        estado_anterior=estado_actual,
        estado_nuevo=estado_nuevo,
        comentario=datos.comentario,
        lat_evento=datos.lat_evento,
        lng_evento=datos.lng_evento,
    ))
    await db.commit()
    await db.refresh(tarea)
    return tarea


async def listar_tareas(
    usuario: dict,
    db: AsyncSession,
    estado: EstadoTarea | None = None,
    tipo: TipoTarea | None = None,
    prioridad: PrioridadTarea | None = None,
) -> list[Tarea]:
    query = select(Tarea).order_by(Tarea.fecha_creada.desc())

    if not usuario.get("es_admin"):
        query = query.where(Tarea.tecnico_id == usuario["id"])

    if estado is not None:
        query = query.where(Tarea.estado == estado)
    if tipo is not None:
        query = query.where(Tarea.tipo == tipo)
    if prioridad is not None:
        query = query.where(Tarea.prioridad == prioridad)

    resultado = await db.execute(query)
    return list(resultado.scalars().all())


async def obtener_tarea(tarea_id: int, usuario: dict, db: AsyncSession) -> Tarea:
    tarea = await _obtener_tarea_o_404(tarea_id, db)

    if not usuario.get("es_admin") and tarea.tecnico_id != usuario["id"]:
        raise PermissionError("No tienes permiso para ver esta tarea")

    return tarea


async def actualizar_tarea(tarea_id: int, datos: TareaUpdate, usuario: dict, db: AsyncSession) -> Tarea:
    tarea = await _obtener_tarea_o_404(tarea_id, db)

    if not usuario.get("es_admin"):
        raise PermissionError("Solo supervisores pueden editar los datos de una tarea")

    if datos.descripcion is not None:
        tarea.descripcion = datos.descripcion
    if datos.prioridad is not None:
        tarea.prioridad = datos.prioridad
    if datos.latitud is not None:
        tarea.latitud = datos.latitud
    if datos.longitud is not None:
        tarea.longitud = datos.longitud

    tarea.updated_at = datetime.now()
    await db.commit()
    await db.refresh(tarea)
    return tarea


async def listar_eventos(tarea_id: int, usuario: dict, db: AsyncSession) -> list[TareaEvento]:
    await obtener_tarea(tarea_id, usuario, db)  # valida acceso

    resultado = await db.execute(
        select(TareaEvento)
        .where(TareaEvento.tarea_id == tarea_id)
        .order_by(TareaEvento.timestamp)
    )
    return list(resultado.scalars().all())


# ── Helpers privados ──────────────────────────────────────────────────────────

async def _obtener_tarea_o_404(tarea_id: int, db: AsyncSession) -> Tarea:
    resultado = await db.execute(select(Tarea).where(Tarea.id == tarea_id))
    tarea = resultado.scalar_one_or_none()
    if tarea is None:
        raise ValueError("Tarea no encontrada")
    return tarea


async def _verificar_tecnico(tecnico_id: int, db: AsyncSession) -> Usuario:
    resultado = await db.execute(select(Usuario).where(Usuario.id == tecnico_id, Usuario.activo == True))  # noqa: E712
    tecnico = resultado.scalar_one_or_none()
    if tecnico is None:
        raise ValueError(f"No existe un usuario activo con id {tecnico_id}")
    return tecnico
