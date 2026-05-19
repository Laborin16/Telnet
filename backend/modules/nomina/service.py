from datetime import date, datetime, timedelta
from sqlalchemy import select, func, update as sa_update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError

from modules.auth.models import Usuario, RolUsuario
from modules.nomina.models import (
    NominaPeriodo, NominaRegistro, NominaIncidencia, NominaPrestamo,
    EstadoPeriodo, EstadoPrestamo, TipoIncidencia,
)
from modules.nomina.schemas import (
    BonoPreview, DiaBono,
    IncidenciaCreate, IncidenciaUpdate, PeriodoCreate, PeriodoDetalle, PeriodoResumen,
    PrestamoCreate, PrestamoResponse, PrestamoUpdate,
    RegistroResponse, RegistroUpdate, IncidenciaResponse,
    DashboardNomina, CostoPorArea,
)


# Tarifa fija por hora extra en MXN. Aplica a todos los empleados.
TARIFA_HORA_EXTRA = 40.0

# Cuota diaria de tareas COMPLETADAS para que el día cuente como cumplido del bono.
# Sábado se reduce porque se trabaja media jornada.
# day_of_week: 0=lunes, 1=martes, ..., 5=sábado, 6=domingo
CUOTAS_BONO_TECNICO: dict[int, dict[str, int]] = {
    0: {"INSTALACION": 6, "SERVICIO": 7, "RECOLECCION": 8},  # lunes
    1: {"INSTALACION": 6, "SERVICIO": 7, "RECOLECCION": 8},  # martes
    2: {"INSTALACION": 6, "SERVICIO": 7, "RECOLECCION": 8},  # miércoles
    3: {"INSTALACION": 6, "SERVICIO": 7, "RECOLECCION": 8},  # jueves
    4: {"INSTALACION": 6, "SERVICIO": 7, "RECOLECCION": 8},  # viernes
    5: {"INSTALACION": 3, "SERVICIO": 3, "RECOLECCION": 4},  # sábado (media)
    6: {"INSTALACION": 6, "SERVICIO": 7, "RECOLECCION": 8},  # domingo
}

# Tipos de tarea que cuentan para el bono.
TIPOS_BONO = ("INSTALACION", "SERVICIO", "RECOLECCION")

# Días que se necesitan cumplidos para ganar el bono.
BONO_DIAS_REQUERIDOS = 6


# ─── Helpers ────────────────────────────────────────────────────────────────

def _lunes_de_semana(d: date | None = None) -> date:
    d = d or date.today()
    return d - timedelta(days=d.weekday())  # weekday(): lunes=0


def _domingo_de_semana(d: date) -> date:
    return d + timedelta(days=6)


async def _usuarios_en_nomina(db: AsyncSession) -> list[Usuario]:
    res = await db.execute(
        select(Usuario).where(Usuario.activo == True, Usuario.en_nomina == True).order_by(Usuario.nombre)  # noqa: E712
    )
    return list(res.scalars().all())


async def _get_usuario(db: AsyncSession, usuario_id: int) -> Usuario | None:
    res = await db.execute(select(Usuario).where(Usuario.id == usuario_id))
    return res.scalar_one_or_none()


# ─── Cálculos ───────────────────────────────────────────────────────────────

def _dias_trabajados(reg: NominaRegistro) -> float:
    return round(reg.dia_1 + reg.dia_2 + reg.dia_3 + reg.dia_4 + reg.dia_5 + reg.dia_6 + reg.dia_7, 2)


def _sueldo_semanal_efectivo(reg: NominaRegistro, usuario: Usuario | None) -> float:
    """Sueldo semanal aplicable: el snapshot si está cerrado, si no el actual del usuario."""
    if reg.sueldo_semanal_aplicado is not None:
        return reg.sueldo_semanal_aplicado
    return float(usuario.sueldo_semanal or 0) if usuario else 0.0


def _calcular_totales(reg: NominaRegistro, usuario: Usuario | None, incidencias: list[NominaIncidencia]) -> dict:
    """Devuelve los importes calculados a partir de la asistencia + incidencias + sueldo aplicable."""
    sueldo_semanal = _sueldo_semanal_efectivo(reg, usuario)
    dias = _dias_trabajados(reg)

    # La nómina base se paga sobre máximo 6 días de la semana, aunque la
    # asistencia se registre los 7. Si asiste ≥6 días recibe el sueldo base
    # completo; si asiste menos, se paga proporcional.
    dias_pagables = min(dias, 6.0)
    importe_base       = round((dias_pagables / 6.0) * sueldo_semanal, 2)
    monto_horas_extra  = round(reg.horas_extra * TARIFA_HORA_EXTRA, 2)

    percepciones_extra = 0.0
    deducciones        = 0.0
    for inc in incidencias:
        if inc.tipo == TipoIncidencia.HORA_EXTRA:
            continue  # las horas extra se cuentan aparte, vía reg.horas_extra
        if inc.diferida:
            continue  # cuota diferida: no afecta el total
        if inc.monto >= 0:
            percepciones_extra += inc.monto
        else:
            deducciones += -inc.monto  # se guarda positivo para mostrar
    percepciones_extra = round(percepciones_extra, 2)
    deducciones        = round(deducciones, 2)

    total = round(importe_base + monto_horas_extra + percepciones_extra - deducciones, 2)
    if total < 0:
        total = 0.0

    return {
        "dias_trabajados":    dias,
        "importe_base":       importe_base,
        "monto_horas_extra":  monto_horas_extra,
        "percepciones_extra": percepciones_extra,
        "deducciones":        deducciones,
        "total_a_pagar":      total,
    }


def _registro_a_response(
    reg: NominaRegistro,
    usuario: Usuario | None,
    incidencias: list[NominaIncidencia],
    bono: BonoPreview | None = None,
    prestamos_map: dict[int, NominaPrestamo] | None = None,
) -> RegistroResponse:
    totales = _calcular_totales(reg, usuario, incidencias)
    inc_resps: list[IncidenciaResponse] = []
    for i in incidencias:
        ir = IncidenciaResponse.model_validate(i, from_attributes=True)
        if i.tipo == TipoIncidencia.CUOTA_PRESTAMO and i.prestamo_id is not None and prestamos_map:
            p = prestamos_map.get(i.prestamo_id)
            if p is not None:
                restantes = max(0, p.cuotas_totales - p.cuotas_pagadas)
                ir.prestamo_saldo_restante = round(restantes * p.cuota_semanal, 2)
        inc_resps.append(ir)
    return RegistroResponse(
        id=reg.id,
        periodo_id=reg.periodo_id,
        usuario_id=reg.usuario_id,
        usuario_nombre=usuario.nombre if usuario else f"Usuario #{reg.usuario_id}",
        area=usuario.area if usuario else None,
        dia_1=reg.dia_1, dia_2=reg.dia_2, dia_3=reg.dia_3, dia_4=reg.dia_4,
        dia_5=reg.dia_5, dia_6=reg.dia_6, dia_7=reg.dia_7,
        horas_extra=reg.horas_extra,
        sueldo_semanal_aplicado=reg.sueldo_semanal_aplicado,
        notas=reg.notas,
        bono_override=reg.bono_override,
        incidencias=inc_resps,
        bono=bono,
        **totales,
    )


# ─── Bono de productividad ──────────────────────────────────────────────────

async def _calcular_bono(db: AsyncSession, usuario: Usuario, periodo: NominaPeriodo) -> BonoPreview | None:
    """Calcula el preview del bono de productividad para un técnico en un periodo.
    Devuelve None si no aplica (no es técnico, o no tiene monto_bono > 0)."""
    if usuario.rol != RolUsuario.TECNICO:
        return None
    if usuario.monto_bono is None or usuario.monto_bono <= 0:
        return None

    from datetime import time as _time
    from modules.reportes.models import Tarea

    inicio = datetime.combine(periodo.fecha_inicio, _time.min)
    fin = datetime.combine(periodo.fecha_fin, _time.max)

    # Excluimos PENDIENTE y CANCELADO desde la query: una tarea PENDIENTE no
    # cuenta como "asignada al técnico" aunque tenga tecnico_id seteado.
    tareas = (await db.execute(
        select(Tarea).where(
            Tarea.tecnico_id == usuario.id,
            Tarea.tipo.in_(TIPOS_BONO),
            Tarea.fecha_inicio.isnot(None),
            Tarea.fecha_inicio >= inicio,
            Tarea.fecha_inicio <= fin,
            Tarea.estado.notin_(("PENDIENTE", "CANCELADO")),
        )
    )).scalars().all()

    # Agrupar por dia_idx (0..6) → tipo → {asignadas, completadas}
    por_dia: dict[int, dict[str, dict[str, int]]] = {i: {} for i in range(7)}
    for t in tareas:
        day_idx = (t.fecha_inicio.date() - periodo.fecha_inicio).days
        if not 0 <= day_idx <= 6:
            continue
        if t.tipo not in TIPOS_BONO:
            continue
        bucket = por_dia[day_idx].setdefault(t.tipo, {"asignadas": 0, "completadas": 0})
        # Estados "asignadas": cualquier estado que NO sea PENDIENTE/CANCELADO
        # (la tarea ya fue tomada por el técnico de algún modo)
        if t.estado not in ("PENDIENTE", "CANCELADO"):
            bucket["asignadas"] += 1
        if t.estado == "COMPLETADO":
            bucket["completadas"] += 1

    detalle: list[DiaBono] = []
    dias_cumplidos = 0
    completadas_totales_semana = 0
    for i in range(7):
        por_tipo = por_dia[i]
        asignaciones_dia = sum(v["asignadas"] for v in por_tipo.values())
        cumplido = False
        if asignaciones_dia == 0:
            cumplido = True  # día libre
        else:
            cuotas = CUOTAS_BONO_TECNICO[i]
            for tipo in TIPOS_BONO:
                d = por_tipo.get(tipo)
                if not d or d["asignadas"] == 0:
                    continue
                if d["completadas"] >= cuotas[tipo] or d["completadas"] == d["asignadas"]:
                    cumplido = True
                    break
        if cumplido:
            dias_cumplidos += 1

        completadas_total = sum(v["completadas"] for v in por_tipo.values())
        completadas_totales_semana += completadas_total
        # Cuota mostrada: la del tipo con más asignadas (el "predominante").
        # Si no hubo tareas, dejar la cuota más estricta (instalación) como referencia.
        cuotas_dia = CUOTAS_BONO_TECNICO[i]
        if asignaciones_dia > 0:
            tipo_top = max(por_tipo.keys(), key=lambda t: por_tipo[t]["asignadas"])
            cuota_mostrada = cuotas_dia.get(tipo_top, cuotas_dia["INSTALACION"])
        else:
            cuota_mostrada = cuotas_dia["INSTALACION"]
        detalle.append(DiaBono(
            dia_idx=i + 1,  # 1=lun, 7=dom (consistente con dia_1..dia_7)
            cuota=cuota_mostrada,
            asignadas_total=asignaciones_dia,
            completadas_total=completadas_total,
            cumplido=cumplido,
        ))

    # Guarda: sin al menos 1 tarea completada en la semana no se gana el bono,
    # aunque la regla de "días libres = cumplidos" diera 7/7.
    gana = (dias_cumplidos >= BONO_DIAS_REQUERIDOS) and (completadas_totales_semana >= 1)

    return BonoPreview(
        aplica=True,
        monto_bono=float(usuario.monto_bono),
        dias_cumplidos=dias_cumplidos,
        dias_requeridos=BONO_DIAS_REQUERIDOS,
        gana=gana,
        detalle_dias=detalle,
    )


async def _sincronizar_bono_registro(
    db: AsyncSession,
    registro: NominaRegistro,
    usuario: Usuario,
    bono: BonoPreview | None,
) -> bool:
    """Materializa o quita la incidencia BONO_PRODUCTIVIDAD respetando el
    override manual del registro. Retorna True si hubo cambios."""
    incidencia = (await db.execute(
        select(NominaIncidencia).where(
            NominaIncidencia.registro_id == registro.id,
            NominaIncidencia.tipo == TipoIncidencia.BONO_PRODUCTIVIDAD,
            NominaIncidencia.auto_generada == True,  # noqa: E712
        )
    )).scalar_one_or_none()

    # Decisión: ¿debe existir la incidencia?
    if registro.bono_override == "QUITAR":
        debe_existir = False
        monto = 0.0
        descripcion = ""
    elif registro.bono_override == "AGREGAR":
        if usuario.monto_bono is None or usuario.monto_bono <= 0:
            debe_existir = False  # sin monto configurado no se puede aplicar
            monto = 0.0
            descripcion = ""
        else:
            debe_existir = True
            monto = float(usuario.monto_bono)
            descripcion = "Bono productividad (aplicado manualmente)"
    else:
        # Auto: depende del cálculo
        if bono is None or not bono.gana:
            debe_existir = False
            monto = 0.0
            descripcion = ""
        else:
            debe_existir = True
            monto = bono.monto_bono
            descripcion = f"Bono productividad: {bono.dias_cumplidos}/{bono.dias_requeridos} días"

    if not debe_existir:
        if incidencia is not None:
            await db.delete(incidencia)
            return True
        return False

    if incidencia is None:
        db.add(NominaIncidencia(
            registro_id=registro.id,
            tipo=TipoIncidencia.BONO_PRODUCTIVIDAD,
            monto=monto,
            descripcion=descripcion,
            auto_generada=True,
        ))
        return True
    if abs(incidencia.monto - monto) > 0.001 or incidencia.descripcion != descripcion:
        incidencia.monto = monto
        incidencia.descripcion = descripcion
        return True
    return False


async def set_bono_override(db: AsyncSession, registro_id: int, override: str | None) -> RegistroResponse:
    """Aplica override manual ('AGREGAR' / 'QUITAR' / None) al bono del registro
    y sincroniza la incidencia inmediatamente."""
    reg = (await db.execute(
        select(NominaRegistro).where(NominaRegistro.id == registro_id)
    )).scalar_one_or_none()
    if reg is None:
        raise ValueError(f"No existe el registro {registro_id}")
    await _verificar_periodo_editable(db, reg.periodo_id)

    usuario = await _get_usuario(db, reg.usuario_id)
    if override == "AGREGAR" and usuario is not None and (usuario.monto_bono is None or usuario.monto_bono <= 0):
        raise ValueError("El empleado no tiene un monto de bono configurado. Edita su perfil primero.")

    reg.bono_override = override
    await db.flush()

    periodo = (await db.execute(
        select(NominaPeriodo).where(NominaPeriodo.id == reg.periodo_id)
    )).scalar_one()
    bono = await _calcular_bono(db, usuario, periodo) if usuario else None
    await _sincronizar_bono_registro(db, reg, usuario, bono)
    await db.commit()

    return await get_registro_response(db, registro_id)


async def _sincronizar_bonos_periodo(db: AsyncSession, periodo: NominaPeriodo) -> None:
    """Recorre los registros del periodo BORRADOR y asegura que las incidencias
    BONO_PRODUCTIVIDAD reflejen el estado real del bono. Idempotente.
    No toca periodos CERRADOS."""
    if periodo.estado != EstadoPeriodo.BORRADOR:
        return
    registros = (await db.execute(
        select(NominaRegistro).where(NominaRegistro.periodo_id == periodo.id)
    )).scalars().all()
    if not registros:
        return
    usuarios = (await db.execute(
        select(Usuario).where(Usuario.id.in_([r.usuario_id for r in registros]))
    )).scalars().all()
    usuarios_map = {u.id: u for u in usuarios}

    cambios = False
    for r in registros:
        usuario = usuarios_map.get(r.usuario_id)
        if usuario is None:
            continue
        bono = await _calcular_bono(db, usuario, periodo)
        if await _sincronizar_bono_registro(db, r, usuario, bono):
            cambios = True
    if cambios:
        await db.commit()


async def evaluar_bono_tecnico(db: AsyncSession, usuario_id: int, fecha_ref: date | None = None) -> None:
    """Recalcula y materializa/quita el bono auto-generado del técnico.

    Llamado tras cualquier cambio de tarea (transición, asignación, fecha).
    Idempotente:
    - Si gana el bono y aún no tiene incidencia auto → la crea.
    - Si deja de ganarlo y sí tiene incidencia auto → la elimina.
    - Si solo cambió el monto_bono del usuario → actualiza la incidencia.
    No toca períodos CERRADOS ni usuarios sin monto_bono.
    """
    if fecha_ref is None:
        fecha_ref = date.today()
    lunes = _lunes_de_semana(fecha_ref)

    periodo = (await db.execute(
        select(NominaPeriodo).where(NominaPeriodo.fecha_inicio == lunes)
    )).scalar_one_or_none()
    if periodo is None or periodo.estado != EstadoPeriodo.BORRADOR:
        return

    usuario = await _get_usuario(db, usuario_id)
    if usuario is None:
        return

    registro = (await db.execute(
        select(NominaRegistro).where(
            NominaRegistro.periodo_id == periodo.id,
            NominaRegistro.usuario_id == usuario_id,
        )
    )).scalar_one_or_none()
    if registro is None:
        return  # el técnico no está en el periodo (no en nómina)

    bono = await _calcular_bono(db, usuario, periodo)
    if await _sincronizar_bono_registro(db, registro, usuario, bono):
        await db.commit()


# ─── Periodos ───────────────────────────────────────────────────────────────

async def crear_periodo(db: AsyncSession, payload: PeriodoCreate | None = None) -> NominaPeriodo:
    """Crea un periodo + sus registros para todos los usuarios en_nomina.
    Es idempotente: si el periodo ya existe en BORRADOR, sincroniza empleados
    faltantes (y les aplica sus cuotas de préstamo activas). Si ya está CERRADA,
    lo retorna sin tocarlo."""
    fecha_inicio = (payload.fecha_inicio if payload and payload.fecha_inicio else None) or _lunes_de_semana()
    fecha_inicio = _lunes_de_semana(fecha_inicio)  # normaliza al lunes
    fecha_fin = _domingo_de_semana(fecha_inicio)

    existente = (await db.execute(
        select(NominaPeriodo).where(NominaPeriodo.fecha_inicio == fecha_inicio)
    )).scalar_one_or_none()
    if existente:
        if existente.estado == EstadoPeriodo.BORRADOR:
            await _sincronizar_empleados(db, existente.id)
            await db.commit()
            await db.refresh(existente)
        return existente

    periodo = NominaPeriodo(fecha_inicio=fecha_inicio, fecha_fin=fecha_fin, estado=EstadoPeriodo.BORRADOR)
    db.add(periodo)
    try:
        await db.flush()
    except IntegrityError:
        await db.rollback()
        existente = (await db.execute(
            select(NominaPeriodo).where(NominaPeriodo.fecha_inicio == fecha_inicio)
        )).scalar_one_or_none()
        if existente:
            return existente
        raise

    await _sincronizar_empleados(db, periodo.id)
    await db.commit()
    await db.refresh(periodo)
    return periodo


async def _sincronizar_empleados(db: AsyncSession, periodo_id: int) -> None:
    """Agrega registros para usuarios en_nomina que aún no tienen registro en el
    periodo, y les aplica sus cuotas de préstamo activas. No toca a los empleados
    que ya tienen registro ni a sus incidencias existentes."""
    usuarios = await _usuarios_en_nomina(db)
    if not usuarios:
        return

    registros_existentes = (await db.execute(
        select(NominaRegistro.usuario_id).where(NominaRegistro.periodo_id == periodo_id)
    )).scalars().all()
    ya_registrados = set(registros_existentes)

    nuevos = [u for u in usuarios if u.id not in ya_registrados]
    if not nuevos:
        return

    for u in nuevos:
        db.add(NominaRegistro(periodo_id=periodo_id, usuario_id=u.id))
    await db.flush()

    await _aplicar_cuotas_prestamos_a_usuarios(db, periodo_id, [u.id for u in nuevos])


async def _aplicar_cuotas_prestamos_a_usuarios(db: AsyncSession, periodo_id: int, usuario_ids: list[int]) -> None:
    """Para cada préstamo ACTIVO de los usuarios indicados, crea una incidencia
    CUOTA_PRESTAMO en su registro del periodo, incrementa cuotas_pagadas y cierra
    el préstamo si llegó al total. Idempotente: si ya existe una incidencia
    auto del mismo préstamo en ese registro, no la duplica."""
    if not usuario_ids:
        return

    prestamos = (await db.execute(
        select(NominaPrestamo).where(
            NominaPrestamo.estado == EstadoPrestamo.ACTIVO.value,
            NominaPrestamo.usuario_id.in_(usuario_ids),
        )
    )).scalars().all()
    if not prestamos:
        return

    registros = (await db.execute(
        select(NominaRegistro).where(
            NominaRegistro.periodo_id == periodo_id,
            NominaRegistro.usuario_id.in_(usuario_ids),
        )
    )).scalars().all()
    reg_por_usuario = {r.usuario_id: r.id for r in registros}

    # Mapa de incidencias existentes por (registro_id, prestamo_id) para evitar duplicar
    registro_ids = [r.id for r in registros]
    if registro_ids:
        existentes = (await db.execute(
            select(NominaIncidencia.registro_id, NominaIncidencia.prestamo_id).where(
                NominaIncidencia.registro_id.in_(registro_ids),
                NominaIncidencia.tipo == TipoIncidencia.CUOTA_PRESTAMO,
                NominaIncidencia.auto_generada == True,  # noqa: E712
            )
        )).all()
        ya_aplicadas: set[tuple[int, int]] = {(r, p) for r, p in existentes if p is not None}
    else:
        ya_aplicadas = set()

    for p in prestamos:
        registro_id = reg_por_usuario.get(p.usuario_id)
        if registro_id is None:
            continue
        if (registro_id, p.id) in ya_aplicadas:
            continue  # ya tiene cuota de este préstamo en este periodo
        db.add(NominaIncidencia(
            registro_id=registro_id,
            tipo=TipoIncidencia.CUOTA_PRESTAMO,
            monto=-abs(p.cuota_semanal),
            descripcion=f"Cuota {p.cuotas_pagadas + 1}/{p.cuotas_totales}: {p.motivo or 'Préstamo'}",
            prestamo_id=p.id,
            auto_generada=True,
        ))
        # UPDATE atómico: incrementa cuotas_pagadas y, si alcanza el total, marca PAGADO
        # en una sola operación SQL (race-safe contra ejecuciones simultáneas).
        await db.execute(
            sa_update(NominaPrestamo)
            .where(NominaPrestamo.id == p.id)
            .values(cuotas_pagadas=NominaPrestamo.cuotas_pagadas + 1)
        )
        await db.refresh(p)
        if p.cuotas_pagadas >= p.cuotas_totales and p.estado == EstadoPrestamo.ACTIVO:
            p.estado = EstadoPrestamo.PAGADO


async def listar_periodos(db: AsyncSession, limit: int = 50) -> list[PeriodoResumen]:
    periodos = (await db.execute(
        select(NominaPeriodo).order_by(NominaPeriodo.fecha_inicio.desc()).limit(limit)
    )).scalars().all()

    resumen: list[PeriodoResumen] = []
    for p in periodos:
        detalle = await get_periodo_detalle(db, p.id)
        resumen.append(PeriodoResumen(
            id=p.id, fecha_inicio=p.fecha_inicio, fecha_fin=p.fecha_fin,
            estado=p.estado, created_at=p.created_at, closed_at=p.closed_at,
            total_empleados=len(detalle.registros),
            total_a_pagar=detalle.total_a_pagar,
        ))
    return resumen


async def get_periodo_detalle(db: AsyncSession, periodo_id: int) -> PeriodoDetalle:
    periodo = (await db.execute(
        select(NominaPeriodo).where(NominaPeriodo.id == periodo_id)
    )).scalar_one_or_none()
    if periodo is None:
        raise ValueError(f"No existe el período {periodo_id}")

    # Reconciliar incidencias de bono con el estado real (preview ↔ BD).
    # Sin esto, técnicos cuyos bonos cambian sin pasar por el hook de tareas
    # (ej. recién agregados, recién marcados con monto_bono) quedan inconsistentes.
    await _sincronizar_bonos_periodo(db, periodo)

    registros = (await db.execute(
        select(NominaRegistro).where(NominaRegistro.periodo_id == periodo_id).order_by(NominaRegistro.id)
    )).scalars().all()

    if not registros:
        return PeriodoDetalle(
            id=periodo.id, fecha_inicio=periodo.fecha_inicio, fecha_fin=periodo.fecha_fin,
            estado=periodo.estado, created_at=periodo.created_at, closed_at=periodo.closed_at,
            closed_by_usuario_id=periodo.closed_by_usuario_id, registros=[], total_a_pagar=0.0,
        )

    usuario_ids = [r.usuario_id for r in registros]
    usuarios = (await db.execute(
        select(Usuario).where(Usuario.id.in_(usuario_ids))
    )).scalars().all()
    usuarios_map = {u.id: u for u in usuarios}

    registro_ids = [r.id for r in registros]
    incidencias = (await db.execute(
        select(NominaIncidencia).where(NominaIncidencia.registro_id.in_(registro_ids)).order_by(NominaIncidencia.id)
    )).scalars().all()
    inc_por_registro: dict[int, list[NominaIncidencia]] = {}
    for inc in incidencias:
        inc_por_registro.setdefault(inc.registro_id, []).append(inc)

    # Mapa de préstamos referenciados por las cuotas para mostrar saldo restante
    prestamos_map = await _cargar_prestamos_map(db, incidencias)

    # Preview del bono para cada técnico aplicable (rol=tecnico, monto_bono>0)
    bonos_por_usuario: dict[int, BonoPreview] = {}
    for u in usuarios:
        b = await _calcular_bono(db, u, periodo)
        if b is not None:
            bonos_por_usuario[u.id] = b

    responses = [
        _registro_a_response(
            r,
            usuarios_map.get(r.usuario_id),
            inc_por_registro.get(r.id, []),
            bonos_por_usuario.get(r.usuario_id),
            prestamos_map,
        )
        for r in registros
    ]
    total = round(sum(rr.total_a_pagar for rr in responses), 2)

    return PeriodoDetalle(
        id=periodo.id, fecha_inicio=periodo.fecha_inicio, fecha_fin=periodo.fecha_fin,
        estado=periodo.estado, created_at=periodo.created_at, closed_at=periodo.closed_at,
        closed_by_usuario_id=periodo.closed_by_usuario_id,
        registros=responses, total_a_pagar=total,
    )


async def cerrar_periodo(db: AsyncSession, periodo_id: int, usuario: dict) -> NominaPeriodo:
    # UPDATE condicional: solo cierra si está en BORRADOR. Race-safe contra
    # doble cierre simultáneo (el segundo no actualiza filas).
    result = await db.execute(
        sa_update(NominaPeriodo)
        .where(NominaPeriodo.id == periodo_id, NominaPeriodo.estado == EstadoPeriodo.BORRADOR.value)
        .values(
            estado=EstadoPeriodo.CERRADA,
            closed_at=datetime.now(),
            closed_by_usuario_id=usuario["id"],
        )
    )
    if result.rowcount == 0:
        # Verificar por qué no se actualizó
        periodo = (await db.execute(
            select(NominaPeriodo).where(NominaPeriodo.id == periodo_id)
        )).scalar_one_or_none()
        if periodo is None:
            raise ValueError(f"No existe el período {periodo_id}")
        raise ValueError("El período ya está cerrado")

    # Congelar sueldo aplicado SOLO si no tiene ya un snapshot. Esto preserva
    # el histórico ante reaperturas: una nómina que ya se pagó conserva el
    # sueldo de cuando se pagó, aunque después se actualice el sueldo del
    # empleado. Registros nuevos (agregados después de un cierre previo)
    # toman el snapshot la primera vez.
    registros = (await db.execute(
        select(NominaRegistro).where(NominaRegistro.periodo_id == periodo_id)
    )).scalars().all()
    if registros:
        sin_snapshot = [r for r in registros if r.sueldo_semanal_aplicado is None]
        if sin_snapshot:
            usuario_ids = [r.usuario_id for r in sin_snapshot]
            usuarios = (await db.execute(select(Usuario).where(Usuario.id.in_(usuario_ids)))).scalars().all()
            usuarios_map = {u.id: u for u in usuarios}
            for r in sin_snapshot:
                u = usuarios_map.get(r.usuario_id)
                r.sueldo_semanal_aplicado = float((u.sueldo_semanal if u and u.sueldo_semanal is not None else 0))

    await db.commit()
    periodo = (await db.execute(
        select(NominaPeriodo).where(NominaPeriodo.id == periodo_id)
    )).scalar_one()
    return periodo


async def reabrir_periodo(db: AsyncSession, periodo_id: int) -> NominaPeriodo:
    periodo = (await db.execute(
        select(NominaPeriodo).where(NominaPeriodo.id == periodo_id)
    )).scalar_one_or_none()
    if periodo is None:
        raise ValueError(f"No existe el período {periodo_id}")
    if periodo.estado == EstadoPeriodo.BORRADOR:
        raise ValueError("El período ya está en borrador")

    periodo.estado = EstadoPeriodo.BORRADOR
    periodo.closed_at = None
    periodo.closed_by_usuario_id = None
    # Importante: NO limpiar `sueldo_semanal_aplicado` de los registros. El
    # snapshot debe conservarse para mantener el histórico intacto. Al volver
    # a cerrar, `cerrar_periodo` no lo sobrescribe (solo llena los NULL).
    # Si necesitas cambiar el sueldo de una nómina pasada, hazlo con una
    # incidencia manual (percepción o deducción).
    await db.commit()
    await db.refresh(periodo)
    return periodo


# ─── Registros ──────────────────────────────────────────────────────────────

async def _get_registro_o_404(db: AsyncSession, registro_id: int) -> NominaRegistro:
    reg = (await db.execute(
        select(NominaRegistro).where(NominaRegistro.id == registro_id)
    )).scalar_one_or_none()
    if reg is None:
        raise ValueError(f"No existe el registro {registro_id}")
    return reg


async def _verificar_periodo_editable(db: AsyncSession, periodo_id: int) -> None:
    """Lanza PermissionError si el período está CERRADA. Usado como guard
    en operaciones de mutación sobre registros e incidencias."""
    periodo = (await db.execute(
        select(NominaPeriodo).where(NominaPeriodo.id == periodo_id)
    )).scalar_one_or_none()
    if periodo is None:
        raise ValueError(f"No existe el período {periodo_id}")
    if periodo.estado == EstadoPeriodo.CERRADA:
        raise PermissionError("El período está cerrado. Reábrelo para editar.")


async def update_registro(db: AsyncSession, registro_id: int, payload: RegistroUpdate) -> RegistroResponse:
    reg = await _get_registro_o_404(db, registro_id)
    await _verificar_periodo_editable(db, reg.periodo_id)
    for campo, valor in payload.model_dump(exclude_unset=True).items():
        setattr(reg, campo, valor)
    await db.commit()
    return await get_registro_response(db, registro_id)


async def get_registro_response(db: AsyncSession, registro_id: int) -> RegistroResponse:
    reg = await _get_registro_o_404(db, registro_id)
    usuario = await _get_usuario(db, reg.usuario_id)
    incidencias = (await db.execute(
        select(NominaIncidencia).where(NominaIncidencia.registro_id == registro_id).order_by(NominaIncidencia.id)
    )).scalars().all()
    periodo = (await db.execute(
        select(NominaPeriodo).where(NominaPeriodo.id == reg.periodo_id)
    )).scalar_one()
    bono = await _calcular_bono(db, usuario, periodo) if usuario else None
    prestamos_map = await _cargar_prestamos_map(db, list(incidencias))
    return _registro_a_response(reg, usuario, list(incidencias), bono, prestamos_map)


async def _cargar_prestamos_map(db: AsyncSession, incidencias: list[NominaIncidencia]) -> dict[int, NominaPrestamo]:
    """Devuelve un mapa {prestamo_id: NominaPrestamo} para todos los préstamos
    referenciados por las incidencias de tipo CUOTA_PRESTAMO."""
    prestamo_ids = {i.prestamo_id for i in incidencias if i.prestamo_id is not None and i.tipo == TipoIncidencia.CUOTA_PRESTAMO}
    if not prestamo_ids:
        return {}
    prestamos = (await db.execute(
        select(NominaPrestamo).where(NominaPrestamo.id.in_(prestamo_ids))
    )).scalars().all()
    return {p.id: p for p in prestamos}


# ─── Incidencias ────────────────────────────────────────────────────────────

async def crear_incidencia(db: AsyncSession, registro_id: int, payload: IncidenciaCreate) -> IncidenciaResponse:
    reg = await _get_registro_o_404(db, registro_id)
    await _verificar_periodo_editable(db, reg.periodo_id)
    inc = NominaIncidencia(
        registro_id=registro_id,
        tipo=payload.tipo,
        monto=payload.monto,
        descripcion=payload.descripcion,
        auto_generada=False,
    )
    db.add(inc)
    await db.commit()
    await db.refresh(inc)
    return IncidenciaResponse.model_validate(inc, from_attributes=True)


async def actualizar_incidencia(db: AsyncSession, incidencia_id: int, payload: IncidenciaUpdate) -> IncidenciaResponse:
    inc = (await db.execute(
        select(NominaIncidencia).where(NominaIncidencia.id == incidencia_id)
    )).scalar_one_or_none()
    if inc is None:
        raise ValueError(f"No existe la incidencia {incidencia_id}")
    reg = await _get_registro_o_404(db, inc.registro_id)
    await _verificar_periodo_editable(db, reg.periodo_id)
    for campo, valor in payload.model_dump(exclude_unset=True).items():
        setattr(inc, campo, valor)
    await db.commit()
    await db.refresh(inc)
    return IncidenciaResponse.model_validate(inc, from_attributes=True)


async def diferir_cuota(db: AsyncSession, incidencia_id: int, diferida: bool) -> IncidenciaResponse:
    """Marca o desmarca una cuota de préstamo como 'no pagada esta semana'.
    Al diferir: la incidencia no entra al total y cuotas_pagadas del préstamo
    se decrementa (extiende el plazo en 1 semana). Al revertir hace lo opuesto.
    Solo aplica a incidencias auto-generadas de tipo CUOTA_PRESTAMO.

    Si el préstamo NO está ACTIVO (PAGADO/CANCELADO), solo se actualiza el flag
    `diferida` sin tocar cuotas_pagadas para no corromper su estado."""
    inc = (await db.execute(
        select(NominaIncidencia).where(NominaIncidencia.id == incidencia_id)
    )).scalar_one_or_none()
    if inc is None:
        raise ValueError(f"No existe la incidencia {incidencia_id}")
    if inc.tipo != TipoIncidencia.CUOTA_PRESTAMO or not inc.auto_generada:
        raise PermissionError("Solo se pueden diferir cuotas de préstamo generadas automáticamente.")
    if inc.diferida == diferida:
        return IncidenciaResponse.model_validate(inc, from_attributes=True)

    reg = await _get_registro_o_404(db, inc.registro_id)
    await _verificar_periodo_editable(db, reg.periodo_id)

    inc.diferida = diferida

    if inc.prestamo_id is not None:
        prestamo = (await db.execute(
            select(NominaPrestamo).where(NominaPrestamo.id == inc.prestamo_id)
        )).scalar_one_or_none()
        if prestamo is not None and prestamo.estado == EstadoPrestamo.ACTIVO:
            if diferida:
                # Atómico: decrementar cuotas_pagadas en BD (race-safe)
                await db.execute(
                    sa_update(NominaPrestamo)
                    .where(NominaPrestamo.id == prestamo.id, NominaPrestamo.cuotas_pagadas > 0)
                    .values(cuotas_pagadas=NominaPrestamo.cuotas_pagadas - 1)
                )
                # Refrescar para chequear el nuevo valor (PAGADO→ACTIVO si ya bajó)
                await db.refresh(prestamo)
                if prestamo.estado == EstadoPrestamo.PAGADO and prestamo.cuotas_pagadas < prestamo.cuotas_totales:
                    prestamo.estado = EstadoPrestamo.ACTIVO
            else:
                # Atómico: incrementar
                await db.execute(
                    sa_update(NominaPrestamo)
                    .where(NominaPrestamo.id == prestamo.id)
                    .values(cuotas_pagadas=NominaPrestamo.cuotas_pagadas + 1)
                )
                await db.refresh(prestamo)
                if prestamo.cuotas_pagadas >= prestamo.cuotas_totales:
                    prestamo.estado = EstadoPrestamo.PAGADO

    await db.commit()
    await db.refresh(inc)
    return IncidenciaResponse.model_validate(inc, from_attributes=True)


async def eliminar_incidencia(db: AsyncSession, incidencia_id: int) -> None:
    inc = (await db.execute(
        select(NominaIncidencia).where(NominaIncidencia.id == incidencia_id)
    )).scalar_one_or_none()
    if inc is None:
        raise ValueError(f"No existe la incidencia {incidencia_id}")

    reg = await _get_registro_o_404(db, inc.registro_id)
    await _verificar_periodo_editable(db, reg.periodo_id)

    # Las cuotas de préstamo se gestionan desde el módulo de préstamos.
    if inc.auto_generada and inc.tipo == TipoIncidencia.CUOTA_PRESTAMO:
        raise PermissionError("Las cuotas de préstamo se gestionan desde el módulo de préstamos, no se pueden eliminar aquí.")

    # Si el admin elimina el bono auto, persistir la decisión con override=QUITAR
    # para que el algoritmo NO lo recree en el siguiente recálculo.
    if inc.auto_generada and inc.tipo == TipoIncidencia.BONO_PRODUCTIVIDAD:
        reg = (await db.execute(
            select(NominaRegistro).where(NominaRegistro.id == inc.registro_id)
        )).scalar_one_or_none()
        if reg is not None:
            reg.bono_override = "QUITAR"

    await db.delete(inc)
    await db.commit()


# ─── Préstamos ──────────────────────────────────────────────────────────────

async def _prestamo_a_response(p: NominaPrestamo, usuario: Usuario | None) -> PrestamoResponse:
    restantes = max(0, p.cuotas_totales - p.cuotas_pagadas)
    saldo = round(restantes * p.cuota_semanal, 2)
    return PrestamoResponse(
        id=p.id, usuario_id=p.usuario_id,
        usuario_nombre=usuario.nombre if usuario else f"Usuario #{p.usuario_id}",
        monto_total=p.monto_total, cuota_semanal=p.cuota_semanal,
        cuotas_totales=p.cuotas_totales, cuotas_pagadas=p.cuotas_pagadas,
        cuotas_restantes=restantes, saldo_pendiente=saldo,
        fecha_inicio=p.fecha_inicio, estado=p.estado, motivo=p.motivo,
        created_at=p.created_at,
    )


async def listar_prestamos(db: AsyncSession, solo_activos: bool = False) -> list[PrestamoResponse]:
    stmt = select(NominaPrestamo).order_by(NominaPrestamo.created_at.desc())
    if solo_activos:
        stmt = stmt.where(NominaPrestamo.estado == EstadoPrestamo.ACTIVO.value)
    prestamos = (await db.execute(stmt)).scalars().all()
    usuario_ids = list({p.usuario_id for p in prestamos})
    usuarios = (await db.execute(select(Usuario).where(Usuario.id.in_(usuario_ids)))).scalars().all() if usuario_ids else []
    usuarios_map = {u.id: u for u in usuarios}
    return [await _prestamo_a_response(p, usuarios_map.get(p.usuario_id)) for p in prestamos]


async def crear_prestamo(db: AsyncSession, payload: PrestamoCreate) -> PrestamoResponse:
    usuario = await _get_usuario(db, payload.usuario_id)
    if usuario is None:
        raise ValueError(f"No existe el usuario {payload.usuario_id}")
    p = NominaPrestamo(
        usuario_id=payload.usuario_id,
        monto_total=payload.monto_total,
        cuota_semanal=payload.cuota_semanal,
        cuotas_totales=payload.cuotas_totales,
        fecha_inicio=payload.fecha_inicio or date.today(),
        motivo=payload.motivo,
    )
    db.add(p)
    await db.commit()
    await db.refresh(p)

    # Aplicar la cuota al periodo BORRADOR de la semana actual si el empleado
    # ya tiene registro (caso normal de préstamo creado a mitad de semana).
    periodo_actual = (await db.execute(
        select(NominaPeriodo).where(
            NominaPeriodo.fecha_inicio == _lunes_de_semana(),
            NominaPeriodo.estado == EstadoPeriodo.BORRADOR,
        )
    )).scalar_one_or_none()
    if periodo_actual is not None:
        registro = (await db.execute(
            select(NominaRegistro).where(
                NominaRegistro.periodo_id == periodo_actual.id,
                NominaRegistro.usuario_id == payload.usuario_id,
            )
        )).scalar_one_or_none()
        if registro is not None:
            await _aplicar_cuotas_prestamos_a_usuarios(db, periodo_actual.id, [payload.usuario_id])
            await db.commit()

    return await _prestamo_a_response(p, usuario)


async def actualizar_prestamo(db: AsyncSession, prestamo_id: int, payload: PrestamoUpdate) -> PrestamoResponse:
    p = (await db.execute(select(NominaPrestamo).where(NominaPrestamo.id == prestamo_id))).scalar_one_or_none()
    if p is None:
        raise ValueError(f"No existe el préstamo {prestamo_id}")
    for campo, valor in payload.model_dump(exclude_unset=True).items():
        setattr(p, campo, valor)
    await db.commit()
    await db.refresh(p)
    usuario = await _get_usuario(db, p.usuario_id)
    return await _prestamo_a_response(p, usuario)


async def cancelar_prestamo(db: AsyncSession, prestamo_id: int) -> None:
    p = (await db.execute(select(NominaPrestamo).where(NominaPrestamo.id == prestamo_id))).scalar_one_or_none()
    if p is None:
        raise ValueError(f"No existe el préstamo {prestamo_id}")
    p.estado = EstadoPrestamo.CANCELADO
    await db.commit()


# ─── Dashboard ──────────────────────────────────────────────────────────────

async def get_dashboard(db: AsyncSession) -> DashboardNomina:
    # Periodo "actual" = el del lunes de esta semana, si existe
    lunes = _lunes_de_semana()
    periodo_actual = (await db.execute(
        select(NominaPeriodo).where(NominaPeriodo.fecha_inicio == lunes)
    )).scalar_one_or_none()

    costo_semanal = 0.0
    costo_por_area_map: dict[str, dict] = {}
    empleados = 0

    if periodo_actual is not None:
        detalle = await get_periodo_detalle(db, periodo_actual.id)
        costo_semanal = detalle.total_a_pagar
        empleados = len(detalle.registros)
        for r in detalle.registros:
            area = r.area or "Sin área"
            d = costo_por_area_map.setdefault(area, {"empleados": 0, "total": 0.0})
            d["empleados"] += 1
            d["total"] += r.total_a_pagar
    else:
        # No hay periodo actual: contar empleados activos en nómina como referencia
        empleados = len(await _usuarios_en_nomina(db))

    costo_por_area = [
        CostoPorArea(area=k, empleados=v["empleados"], total=round(v["total"], 2))
        for k, v in sorted(costo_por_area_map.items())
    ]

    prestamos_activos_q = await db.execute(
        select(func.count(NominaPrestamo.id), func.coalesce(func.sum((NominaPrestamo.cuotas_totales - NominaPrestamo.cuotas_pagadas) * NominaPrestamo.cuota_semanal), 0.0))
        .where(NominaPrestamo.estado == EstadoPrestamo.ACTIVO.value)
    )
    count_activos, monto_pendiente = prestamos_activos_q.one()

    return DashboardNomina(
        periodo_actual_id=periodo_actual.id if periodo_actual else None,
        costo_semanal=round(costo_semanal, 2),
        empleados_en_nomina=empleados,
        costo_por_area=costo_por_area,
        prestamos_activos=int(count_activos or 0),
        monto_prestamos_pendiente=round(float(monto_pendiente or 0), 2),
    )


# ─── Cron ───────────────────────────────────────────────────────────────────

async def cron_lunes(db: AsyncSession) -> dict:
    """Llamado por APScheduler cada lunes 00:01 zona Hermosillo."""
    periodo = await crear_periodo(db, PeriodoCreate())
    return {
        "periodo_id": periodo.id,
        "fecha_inicio": periodo.fecha_inicio.isoformat(),
        "estado": periodo.estado.value,
    }
