import uuid
from datetime import datetime, timedelta
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from modules.auth.models import Usuario
from modules.reportes.enums import EstadoTarea, PrioridadTarea, TipoTarea
from modules.reportes.models import Tarea, TareaEvento, TareaFoto
from modules.reportes.schemas import AsignarTecnico, TareaCreate, TareaUpdate, TransicionEstado
from modules.reportes.state_machine import validar_transicion

MEDIA_DIR = Path("media/fotos")
MEDIA_DIR.mkdir(parents=True, exist_ok=True)

EXTENSIONES_PERMITIDAS = {".jpg", ".jpeg", ".png", ".webp", ".heic"}

SLA_HORAS: dict[str, int] = {
    "FALLA_RED": 4,
    "SOPORTE_TECNICO": 8,
    "MANTENIMIENTO": 24,
    "CAMBIO_PLAN": 24,
    "INSTALACION": 48,
    "REUBICACION": 48,
    "RECOLECCION": 72,
}


async def crear_tarea(datos: TareaCreate, usuario: dict, db: AsyncSession) -> Tarea:
    estado_inicial = EstadoTarea.PENDIENTE
    fecha_asignada = None

    if datos.tecnico_id is not None:
        tecnico = await _verificar_tecnico(datos.tecnico_id, db)
        estado_inicial = EstadoTarea.ASIGNADO
        fecha_asignada = datetime.now()

    fecha_creada = datetime.now()
    horas_sla = SLA_HORAS.get(datos.tipo, 48)
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
        fecha_creada=fecha_creada,
        fecha_limite=fecha_creada + timedelta(hours=horas_sla),
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

    from modules.reportes import notificaciones
    try:
        await notificaciones.enviar_push(
            usuario_id=tecnico.id,
            titulo="Nueva tarea asignada",
            cuerpo=f"{tarea.tipo.replace('_', ' ').title()} · Servicio {tarea.id_servicio}",
            db=db,
            data={"tarea_id": tarea.id},
        )
    except Exception:
        pass

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

    _ESTADOS_NOTIFICAR_SUPERVISOR = {
        EstadoTarea.BLOQUEADO,
        EstadoTarea.COMPLETADO,
        EstadoTarea.CANCELADO,
    }
    if estado_nuevo in _ESTADOS_NOTIFICAR_SUPERVISOR:
        _TITULOS = {
            EstadoTarea.BLOQUEADO:   "Tarea bloqueada",
            EstadoTarea.COMPLETADO:  "Tarea completada",
            EstadoTarea.CANCELADO:   "Tarea cancelada",
        }
        cuerpo = f"{tarea.tipo.replace('_', ' ').title()} · Servicio {tarea.id_servicio}"
        if estado_nuevo == EstadoTarea.BLOQUEADO and datos.comentario:
            cuerpo += f"\n{datos.comentario}"
        from modules.reportes import notificaciones
        try:
            await notificaciones.enviar_push(
                usuario_id=tarea.supervisor_id,
                titulo=_TITULOS[estado_nuevo],
                cuerpo=cuerpo,
                db=db,
                data={"tarea_id": tarea.id},
            )
        except Exception:
            pass

    return tarea


async def listar_tareas(
    usuario: dict,
    db: AsyncSession,
    estado: EstadoTarea | None = None,
    tipo: TipoTarea | None = None,
    prioridad: PrioridadTarea | None = None,
    tecnico_id: int | None = None,
) -> list[Tarea]:
    query = select(Tarea).order_by(Tarea.fecha_creada.desc())

    if not usuario.get("es_admin"):
        query = query.where(Tarea.tecnico_id == usuario["id"])
    elif tecnico_id == -1:
        query = query.where(Tarea.tecnico_id.is_(None))
    elif tecnico_id is not None:
        query = query.where(Tarea.tecnico_id == tecnico_id)

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


async def subir_foto(tarea_id: int, nombre_original: str, contenido: bytes, usuario: dict, db: AsyncSession) -> TareaFoto:
    await obtener_tarea(tarea_id, usuario, db)  # valida acceso

    ext = Path(nombre_original).suffix.lower()
    if ext not in EXTENSIONES_PERMITIDAS:
        raise ValueError(f"Tipo de archivo no permitido. Usa: {', '.join(EXTENSIONES_PERMITIDAS)}")

    nombre_archivo = f"{uuid.uuid4().hex}{ext}"
    ruta_archivo = MEDIA_DIR / nombre_archivo
    ruta_archivo.write_bytes(contenido)

    foto = TareaFoto(
        tarea_id=tarea_id,
        ruta=f"media/fotos/{nombre_archivo}",
        nombre_original=nombre_original,
        subido_por_id=usuario.get("id"),
        subido_por_nombre=usuario.get("nombre", "Sin identificar"),
        timestamp=datetime.now(),
    )
    db.add(foto)
    await db.commit()
    await db.refresh(foto)
    return foto


async def listar_fotos(tarea_id: int, usuario: dict, db: AsyncSession) -> list[TareaFoto]:
    await obtener_tarea(tarea_id, usuario, db)  # valida acceso

    resultado = await db.execute(
        select(TareaFoto)
        .where(TareaFoto.tarea_id == tarea_id)
        .order_by(TareaFoto.timestamp)
    )
    return list(resultado.scalars().all())


async def registrar_suscripcion(datos, usuario: dict, db: AsyncSession):
    from modules.reportes.models import SuscripcionPush
    resultado = await db.execute(
        select(SuscripcionPush).where(
            SuscripcionPush.usuario_id == usuario["id"],
            SuscripcionPush.endpoint == datos.endpoint,
        )
    )
    sub = resultado.scalar_one_or_none()
    if sub:
        sub.p256dh = datos.p256dh
        sub.auth = datos.auth
        sub.user_agent = datos.user_agent
    else:
        sub = SuscripcionPush(
            usuario_id=usuario["id"],
            endpoint=datos.endpoint,
            p256dh=datos.p256dh,
            auth=datos.auth,
            user_agent=datos.user_agent,
        )
        db.add(sub)
    await db.commit()


async def eliminar_suscripcion(endpoint: str, usuario: dict, db: AsyncSession) -> None:
    from modules.reportes.models import SuscripcionPush
    resultado = await db.execute(
        select(SuscripcionPush).where(
            SuscripcionPush.usuario_id == usuario["id"],
            SuscripcionPush.endpoint == endpoint,
        )
    )
    sub = resultado.scalar_one_or_none()
    if sub:
        await db.delete(sub)
        await db.commit()


async def _verificar_tecnico(tecnico_id: int, db: AsyncSession) -> Usuario:
    resultado = await db.execute(select(Usuario).where(Usuario.id == tecnico_id, Usuario.activo == True))  # noqa: E712
    tecnico = resultado.scalar_one_or_none()
    if tecnico is None:
        raise ValueError(f"No existe un usuario activo con id {tecnico_id}")
    return tecnico
