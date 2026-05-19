"""Service layer del módulo Pagos por hacer (gastos de la empresa).

Responsabilidad:
- CRUD de categorías (con soft delete vía `activa`).
- CRUD de pagos.
- `marcar_pagado`: setea PAGADO, guarda comprobante (opcional) y genera la
  siguiente instancia si el pago es recurrente. Atómico.
- `cron_recordatorios_pagos_empresa`: envía push a admins 2 días antes del
  vencimiento; idempotente por día.
"""
from __future__ import annotations

import calendar
import os
import uuid
from datetime import date, datetime, timedelta

from sqlalchemy import Date, cast, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from modules.auth.models import RolUsuario, Usuario
from modules.pagos_empresa.models import (
    CategoriaPagoEmpresa,
    EstadoPagoEmpresa,
    PagoEmpresa,
    RecurrenciaPago,
)
from modules.pagos_empresa.schemas import (
    CategoriaCreate,
    CategoriaResponse,
    CategoriaUpdate,
    PagoCreate,
    PagoResponse,
    PagoUpdate,
)


# Subdirectorio bajo data/comprobantes/ para no mezclar con pagos de clientes.
_COMPROBANTES_SUBDIR = "pagos_empresa"
_COMPROBANTES_BASE_DIR = os.path.join("data", "comprobantes", _COMPROBANTES_SUBDIR)
_COMPROBANTE_EXT_PERMITIDAS = {".jpg", ".jpeg", ".png", ".pdf", ".webp"}
_COMPROBANTE_MAX_BYTES = 10 * 1024 * 1024


# ─── Helpers ────────────────────────────────────────────────────────────────


def _categoria_a_response(c: CategoriaPagoEmpresa) -> CategoriaResponse:
    return CategoriaResponse.model_validate(c, from_attributes=True)


def _pago_a_response(p: PagoEmpresa, categoria_nombre: str) -> PagoResponse:
    comprobante_url = (
        f"/static/comprobantes/{p.comprobante_path}" if p.comprobante_path else None
    )
    return PagoResponse(
        id=p.id,
        categoria_id=p.categoria_id,
        categoria_nombre=categoria_nombre,
        concepto=p.concepto,
        monto=float(p.monto),
        fecha_vencimiento=p.fecha_vencimiento,
        recurrencia=RecurrenciaPago(p.recurrencia) if isinstance(p.recurrencia, str) else p.recurrencia,
        estado=EstadoPagoEmpresa(p.estado) if isinstance(p.estado, str) else p.estado,
        proveedor=p.proveedor,
        notas=p.notas,
        comprobante_url=comprobante_url,
        fecha_pago=p.fecha_pago,
        recordatorio_enviado_at=p.recordatorio_enviado_at,
        created_at=p.created_at,
    )


def _siguiente_fecha(fecha: date, recurrencia: RecurrenciaPago) -> date:
    """Calcula la fecha de la siguiente instancia recurrente.

    - SEMANAL: +7 días.
    - QUINCENAL: +15 días.
    - MENSUAL: avanza un mes preservando el día; si el mes destino no tiene
      ese día (ej. 31 → mes de 30), cae al último día del mes.
    - ANUAL: mismo día/mes, +1 año; maneja 29-feb → 28-feb en años no bisiestos.
    """
    if recurrencia == RecurrenciaPago.SEMANAL:
        return fecha + timedelta(days=7)
    if recurrencia == RecurrenciaPago.QUINCENAL:
        return fecha + timedelta(days=15)
    if recurrencia == RecurrenciaPago.MENSUAL:
        anio = fecha.year + (1 if fecha.month == 12 else 0)
        mes = 1 if fecha.month == 12 else fecha.month + 1
        ultimo_dia = calendar.monthrange(anio, mes)[1]
        dia = min(fecha.day, ultimo_dia)
        return date(anio, mes, dia)
    if recurrencia == RecurrenciaPago.ANUAL:
        anio = fecha.year + 1
        ultimo_dia = calendar.monthrange(anio, fecha.month)[1]
        dia = min(fecha.day, ultimo_dia)
        return date(anio, fecha.month, dia)
    return fecha


def _guardar_comprobante_empresa(filename: str, content: bytes) -> str:
    """Valida y guarda el archivo en disco; retorna la ruta relativa
    (a partir de data/comprobantes/, p.ej. 'pagos_empresa/<uuid>.jpg').

    Raises:
        ValueError si la extensión no está permitida o supera el tamaño máx.
    """
    ext = os.path.splitext(filename or "")[1].lower()
    if ext not in _COMPROBANTE_EXT_PERMITIDAS:
        raise ValueError("Formato de comprobante no permitido. Usa JPG, PNG, WEBP o PDF.")
    if len(content) > _COMPROBANTE_MAX_BYTES:
        raise ValueError("El comprobante no puede superar 10 MB.")
    os.makedirs(_COMPROBANTES_BASE_DIR, exist_ok=True)
    safe_name = f"{uuid.uuid4().hex}{ext}"
    full_path = os.path.join(_COMPROBANTES_BASE_DIR, safe_name)
    with open(full_path, "wb") as f:
        f.write(content)
    return f"{_COMPROBANTES_SUBDIR}/{safe_name}"


async def _get_categoria_o_404(db: AsyncSession, cat_id: int) -> CategoriaPagoEmpresa:
    c = (await db.execute(
        select(CategoriaPagoEmpresa).where(CategoriaPagoEmpresa.id == cat_id)
    )).scalar_one_or_none()
    if c is None:
        raise ValueError(f"No existe la categoría {cat_id}")
    return c


async def _get_pago_o_404(db: AsyncSession, pago_id: int) -> PagoEmpresa:
    p = (await db.execute(
        select(PagoEmpresa).where(PagoEmpresa.id == pago_id)
    )).scalar_one_or_none()
    if p is None:
        raise ValueError(f"No existe el pago {pago_id}")
    return p


# ─── Categorías ─────────────────────────────────────────────────────────────


async def listar_categorias(db: AsyncSession, incluir_inactivas: bool = False) -> list[CategoriaResponse]:
    stmt = select(CategoriaPagoEmpresa).order_by(CategoriaPagoEmpresa.orden, CategoriaPagoEmpresa.nombre)
    if not incluir_inactivas:
        stmt = stmt.where(CategoriaPagoEmpresa.activa == True)  # noqa: E712
    rows = (await db.execute(stmt)).scalars().all()
    return [_categoria_a_response(c) for c in rows]


async def crear_categoria(db: AsyncSession, payload: CategoriaCreate) -> CategoriaResponse:
    c = CategoriaPagoEmpresa(
        nombre=payload.nombre.strip(),
        descripcion=(payload.descripcion.strip() if payload.descripcion else None) or None,
        orden=payload.orden,
        activa=True,
    )
    db.add(c)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise ValueError("Ya existe una categoría con ese nombre.")
    await db.refresh(c)
    return _categoria_a_response(c)


async def actualizar_categoria(db: AsyncSession, cat_id: int, payload: CategoriaUpdate) -> CategoriaResponse:
    c = await _get_categoria_o_404(db, cat_id)
    data = payload.model_dump(exclude_unset=True)
    if "nombre" in data and data["nombre"]:
        c.nombre = data["nombre"].strip()
    if "descripcion" in data:
        c.descripcion = (data["descripcion"] or "").strip() or None
    if "orden" in data and data["orden"] is not None:
        c.orden = data["orden"]
    if "activa" in data and data["activa"] is not None:
        c.activa = bool(data["activa"])
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise ValueError("Ya existe una categoría con ese nombre.")
    await db.refresh(c)
    return _categoria_a_response(c)


async def eliminar_categoria(db: AsyncSession, cat_id: int) -> None:
    """Hard delete; solo permitido si la categoría no tiene pagos.
    Para 'eliminar' una categoría con pagos, usar `activa=false` (soft delete)."""
    c = await _get_categoria_o_404(db, cat_id)
    n = (await db.execute(
        select(PagoEmpresa.id).where(PagoEmpresa.categoria_id == cat_id).limit(1)
    )).scalar_one_or_none()
    if n is not None:
        raise PermissionError(
            "Esta categoría tiene pagos registrados. Archívala (soft delete) en lugar de eliminarla."
        )
    await db.delete(c)
    await db.commit()


# ─── Pagos ──────────────────────────────────────────────────────────────────


async def listar_pagos(
    db: AsyncSession,
    categoria_id: int | None = None,
    estado: EstadoPagoEmpresa | str | None = None,
    archivadas: bool = False,
) -> list[PagoResponse]:
    """archivadas=True devuelve pagos cuyas categorías están inactivas."""
    stmt = select(PagoEmpresa, CategoriaPagoEmpresa).join(
        CategoriaPagoEmpresa, CategoriaPagoEmpresa.id == PagoEmpresa.categoria_id
    )
    if archivadas:
        stmt = stmt.where(CategoriaPagoEmpresa.activa == False)  # noqa: E712
    else:
        stmt = stmt.where(CategoriaPagoEmpresa.activa == True)  # noqa: E712
    if categoria_id is not None:
        stmt = stmt.where(PagoEmpresa.categoria_id == categoria_id)
    if estado is not None:
        valor = estado.value if isinstance(estado, EstadoPagoEmpresa) else estado
        stmt = stmt.where(PagoEmpresa.estado == valor)
    stmt = stmt.order_by(PagoEmpresa.fecha_vencimiento.asc(), PagoEmpresa.id.asc())
    rows = (await db.execute(stmt)).all()
    return [_pago_a_response(p, c.nombre) for p, c in rows]


async def crear_pago(db: AsyncSession, payload: PagoCreate) -> PagoResponse:
    categoria = await _get_categoria_o_404(db, payload.categoria_id)
    if not categoria.activa:
        raise ValueError("La categoría está archivada. Reactívala para registrar pagos.")
    p = PagoEmpresa(
        categoria_id=categoria.id,
        concepto=payload.concepto.strip(),
        monto=payload.monto,
        fecha_vencimiento=payload.fecha_vencimiento,
        recurrencia=payload.recurrencia,
        estado=EstadoPagoEmpresa.PENDIENTE,
        proveedor=(payload.proveedor.strip() if payload.proveedor else None) or None,
        notas=(payload.notas.strip() if payload.notas else None) or None,
    )
    db.add(p)
    await db.commit()
    await db.refresh(p)
    return _pago_a_response(p, categoria.nombre)


async def actualizar_pago(db: AsyncSession, pago_id: int, payload: PagoUpdate) -> PagoResponse:
    p = await _get_pago_o_404(db, pago_id)
    estado_actual = EstadoPagoEmpresa(p.estado) if isinstance(p.estado, str) else p.estado
    if estado_actual == EstadoPagoEmpresa.PAGADO:
        raise PermissionError("No se puede editar un pago ya pagado. Elimínalo y créalo de nuevo si necesitas corregir datos.")
    data = payload.model_dump(exclude_unset=True)

    if "categoria_id" in data and data["categoria_id"] is not None and data["categoria_id"] != p.categoria_id:
        nueva = await _get_categoria_o_404(db, data["categoria_id"])
        if not nueva.activa:
            raise ValueError("No puedes mover un pago a una categoría archivada.")
        p.categoria_id = nueva.id

    if "concepto" in data and data["concepto"]:
        p.concepto = data["concepto"].strip()
    if "monto" in data and data["monto"] is not None:
        p.monto = data["monto"]
    if "fecha_vencimiento" in data and data["fecha_vencimiento"] is not None:
        p.fecha_vencimiento = data["fecha_vencimiento"]
    if "recurrencia" in data and data["recurrencia"] is not None:
        p.recurrencia = data["recurrencia"]
    if "proveedor" in data:
        p.proveedor = (data["proveedor"] or "").strip() or None
    if "notas" in data:
        p.notas = (data["notas"] or "").strip() or None

    await db.commit()
    await db.refresh(p)
    categoria = await _get_categoria_o_404(db, p.categoria_id)
    return _pago_a_response(p, categoria.nombre)


async def eliminar_pago(db: AsyncSession, pago_id: int) -> None:
    p = await _get_pago_o_404(db, pago_id)
    comprobante_path = p.comprobante_path
    await db.delete(p)
    await db.commit()
    # Borrar archivo del disco; ignorar si no existe
    if comprobante_path:
        full_path = os.path.join("data", "comprobantes", comprobante_path)
        try:
            os.remove(full_path)
        except OSError:
            pass


async def marcar_pagado(
    db: AsyncSession,
    pago_id: int,
    notas: str | None,
    comprobante_filename: str | None,
    comprobante_content: bytes | None,
) -> tuple[PagoResponse, PagoResponse | None]:
    """Marca un pago como PAGADO; opcionalmente guarda comprobante; si es
    recurrente, crea atómicamente la siguiente instancia.

    Retorna tupla `(pago_actualizado, siguiente_pago_o_None)`.
    """
    p = await _get_pago_o_404(db, pago_id)
    estado_actual = EstadoPagoEmpresa(p.estado) if isinstance(p.estado, str) else p.estado
    if estado_actual != EstadoPagoEmpresa.PENDIENTE:
        raise PermissionError("Este pago ya estaba marcado como pagado.")

    # Validar y guardar comprobante (si llegó); ANTES del commit, para revertir si falla
    if comprobante_content is not None:
        ruta = _guardar_comprobante_empresa(comprobante_filename or "comprobante", comprobante_content)
        p.comprobante_path = ruta

    p.estado = EstadoPagoEmpresa.PAGADO
    p.fecha_pago = datetime.now()
    if notas is not None:
        p.notas = (notas.strip() or None) if notas else p.notas

    siguiente: PagoEmpresa | None = None
    recurrencia = RecurrenciaPago(p.recurrencia) if isinstance(p.recurrencia, str) else p.recurrencia
    if recurrencia != RecurrenciaPago.NINGUNA:
        siguiente_fecha_calc = _siguiente_fecha(p.fecha_vencimiento, recurrencia)
        siguiente = PagoEmpresa(
            categoria_id=p.categoria_id,
            concepto=p.concepto,
            monto=p.monto,
            fecha_vencimiento=siguiente_fecha_calc,
            recurrencia=recurrencia,
            estado=EstadoPagoEmpresa.PENDIENTE,
            proveedor=p.proveedor,
            notas=p.notas,
        )
        db.add(siguiente)

    await db.commit()
    await db.refresh(p)
    if siguiente is not None:
        await db.refresh(siguiente)

    categoria = await _get_categoria_o_404(db, p.categoria_id)
    return (
        _pago_a_response(p, categoria.nombre),
        _pago_a_response(siguiente, categoria.nombre) if siguiente else None,
    )


async def subir_comprobante_pago(
    db: AsyncSession,
    pago_id: int,
    filename: str,
    content: bytes,
) -> PagoResponse:
    """Adjunta/reemplaza el comprobante de un pago existente."""
    p = await _get_pago_o_404(db, pago_id)
    ruta_anterior = p.comprobante_path
    ruta_nueva = _guardar_comprobante_empresa(filename, content)
    p.comprobante_path = ruta_nueva
    await db.commit()
    await db.refresh(p)
    # Borrar archivo anterior (silencioso si no existe)
    if ruta_anterior:
        try:
            os.remove(os.path.join("data", "comprobantes", ruta_anterior))
        except OSError:
            pass
    categoria = await _get_categoria_o_404(db, p.categoria_id)
    return _pago_a_response(p, categoria.nombre)


# ─── Cron ───────────────────────────────────────────────────────────────────


async def cron_recordatorios_pagos_empresa(db: AsyncSession) -> dict:
    """Envía recordatorios push a todos los admins activos para pagos
    PENDIENTES con vencimiento dentro de los próximos 2 días.

    Idempotente por día: si el cron corre dos veces el mismo día sobre el
    mismo pago, solo envía la primera vez (`cast(recordatorio_enviado_at, Date) < hoy`).
    Re-envía al día siguiente si el pago sigue pendiente.
    """
    from modules.reportes.notificaciones import enviar_push

    hoy = date.today()
    limite = hoy + timedelta(days=2)
    pagos = (await db.execute(
        select(PagoEmpresa).where(
            PagoEmpresa.estado == EstadoPagoEmpresa.PENDIENTE.value,
            PagoEmpresa.fecha_vencimiento >= hoy,
            PagoEmpresa.fecha_vencimiento <= limite,
            or_(
                PagoEmpresa.recordatorio_enviado_at.is_(None),
                cast(PagoEmpresa.recordatorio_enviado_at, Date) < hoy,
            ),
        )
    )).scalars().all()

    if not pagos:
        return {"pagos_notificados": 0, "admins_objetivo": 0}

    admins = (await db.execute(
        select(Usuario).where(
            Usuario.rol == RolUsuario.ADMINISTRADOR,
            Usuario.activo == True,  # noqa: E712
        )
    )).scalars().all()

    for p in pagos:
        dias = (p.fecha_vencimiento - hoy).days
        if dias == 0:
            aviso = "Vence hoy"
        elif dias == 1:
            aviso = "Vence mañana"
        else:
            aviso = f"Vence en {dias} días"
        titulo = f"Pago pendiente: {p.concepto}"
        cuerpo = f"{aviso} · ${float(p.monto):,.2f}"
        for a in admins:
            try:
                await enviar_push(
                    usuario_id=a.id,
                    titulo=titulo,
                    cuerpo=cuerpo,
                    db=db,
                    data={"tipo": "pago_empresa", "pago_id": p.id},
                )
            except Exception:
                pass
        p.recordatorio_enviado_at = datetime.now()

    await db.commit()
    return {"pagos_notificados": len(pagos), "admins_objetivo": len(admins)}
