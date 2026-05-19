import json
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from core.dependencies import get_usuario, requerir_admin
from db.session import get_db
from modules.auditlog.service import log_accion
from modules.pagos_empresa import service
from modules.pagos_empresa.schemas import (
    CategoriaCreate,
    CategoriaResponse,
    CategoriaUpdate,
    PagoCreate,
    PagoResponse,
    PagoUpdate,
)

router = APIRouter()


# ─── Categorías ─────────────────────────────────────────────────────────────


@router.get("/categorias", response_model=list[CategoriaResponse])
async def listar_categorias(
    incluir_inactivas: bool = False,
    db: AsyncSession = Depends(get_db),
    usuario: dict = Depends(get_usuario),
):
    requerir_admin(usuario)
    return await service.listar_categorias(db, incluir_inactivas=incluir_inactivas)


@router.post("/categorias", response_model=CategoriaResponse, status_code=201)
async def crear_categoria(
    payload: CategoriaCreate,
    db: AsyncSession = Depends(get_db),
    usuario: dict = Depends(get_usuario),
):
    requerir_admin(usuario)
    try:
        cat = await service.crear_categoria(db, payload)
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))
    await log_accion(
        db=db, usuario=usuario, accion="CREAR", modulo="pagos_empresa",
        entidad="categoria", entidad_id=str(cat.id),
        descripcion=f"Categoría '{cat.nombre}' creada",
    )
    return cat


@router.patch("/categorias/{cat_id}", response_model=CategoriaResponse)
async def actualizar_categoria(
    cat_id: int,
    payload: CategoriaUpdate,
    db: AsyncSession = Depends(get_db),
    usuario: dict = Depends(get_usuario),
):
    requerir_admin(usuario)
    try:
        cat = await service.actualizar_categoria(db, cat_id, payload)
    except ValueError as e:
        msg = str(e)
        code = 409 if "Ya existe" in msg else 404
        raise HTTPException(status_code=code, detail=msg)
    await log_accion(
        db=db, usuario=usuario, accion="ACTUALIZAR", modulo="pagos_empresa",
        entidad="categoria", entidad_id=str(cat_id),
        descripcion=f"Categoría '{cat.nombre}' actualizada",
        datos_extra=payload.model_dump(exclude_unset=True),
    )
    return cat


@router.delete("/categorias/{cat_id}")
async def eliminar_categoria(
    cat_id: int,
    db: AsyncSession = Depends(get_db),
    usuario: dict = Depends(get_usuario),
):
    requerir_admin(usuario)
    try:
        await service.eliminar_categoria(db, cat_id)
    except PermissionError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    await log_accion(
        db=db, usuario=usuario, accion="ELIMINAR", modulo="pagos_empresa",
        entidad="categoria", entidad_id=str(cat_id),
        descripcion=f"Categoría {cat_id} eliminada",
    )
    return {"ok": True}


# ─── Pagos ──────────────────────────────────────────────────────────────────


@router.get("/pagos", response_model=list[PagoResponse])
async def listar_pagos(
    categoria_id: int | None = None,
    estado: str | None = None,
    archivadas: bool = False,
    db: AsyncSession = Depends(get_db),
    usuario: dict = Depends(get_usuario),
):
    requerir_admin(usuario)
    return await service.listar_pagos(db, categoria_id=categoria_id, estado=estado, archivadas=archivadas)


@router.post("/pagos", response_model=PagoResponse, status_code=201)
async def crear_pago(
    payload: PagoCreate,
    db: AsyncSession = Depends(get_db),
    usuario: dict = Depends(get_usuario),
):
    requerir_admin(usuario)
    try:
        pago = await service.crear_pago(db, payload)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    await log_accion(
        db=db, usuario=usuario, accion="CREAR", modulo="pagos_empresa",
        entidad="pago", entidad_id=str(pago.id),
        descripcion=f"Pago '{pago.concepto}' (${pago.monto}) creado en categoría {pago.categoria_nombre}",
        datos_extra={"categoria_id": pago.categoria_id, "monto": pago.monto, "recurrencia": pago.recurrencia.value},
    )
    return pago


@router.patch("/pagos/{pago_id}", response_model=PagoResponse)
async def actualizar_pago(
    pago_id: int,
    payload: PagoUpdate,
    db: AsyncSession = Depends(get_db),
    usuario: dict = Depends(get_usuario),
):
    requerir_admin(usuario)
    try:
        pago = await service.actualizar_pago(db, pago_id, payload)
    except PermissionError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    await log_accion(
        db=db, usuario=usuario, accion="ACTUALIZAR", modulo="pagos_empresa",
        entidad="pago", entidad_id=str(pago_id),
        descripcion=f"Pago {pago_id} editado",
        datos_extra=payload.model_dump(exclude_unset=True, mode="json"),
    )
    return pago


@router.delete("/pagos/{pago_id}")
async def eliminar_pago(
    pago_id: int,
    db: AsyncSession = Depends(get_db),
    usuario: dict = Depends(get_usuario),
):
    requerir_admin(usuario)
    try:
        await service.eliminar_pago(db, pago_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    await log_accion(
        db=db, usuario=usuario, accion="ELIMINAR", modulo="pagos_empresa",
        entidad="pago", entidad_id=str(pago_id),
        descripcion=f"Pago {pago_id} eliminado",
    )
    return {"ok": True}


@router.post("/pagos/{pago_id}/pagar")
async def marcar_pagado(
    pago_id: int,
    data: str = Form(...),
    comprobante: UploadFile | None = File(None),
    db: AsyncSession = Depends(get_db),
    usuario: dict = Depends(get_usuario),
):
    requerir_admin(usuario)
    try:
        payload_dict = json.loads(data)
        if not isinstance(payload_dict, dict):
            raise ValueError("data debe ser un objeto JSON")
    except (ValueError, json.JSONDecodeError) as e:
        raise HTTPException(status_code=422, detail=f"data inválida: {e}")
    notas = payload_dict.get("notas")

    contenido = await comprobante.read() if comprobante is not None else None
    filename = comprobante.filename if comprobante is not None else None

    try:
        pago, siguiente = await service.marcar_pagado(db, pago_id, notas, filename, contenido)
    except PermissionError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except ValueError as e:
        # Puede venir de validación de archivo o de "no existe"
        code = 400 if "comprobante" in str(e).lower() or "permitido" in str(e).lower() or "MB" in str(e) else 404
        raise HTTPException(status_code=code, detail=str(e))

    await log_accion(
        db=db, usuario=usuario, accion="PAGAR", modulo="pagos_empresa",
        entidad="pago", entidad_id=str(pago_id),
        descripcion=f"Pago '{pago.concepto}' marcado como PAGADO",
        datos_extra={
            "monto": pago.monto,
            "comprobante_adjunto": comprobante is not None,
            "siguiente_pago_id": siguiente.id if siguiente else None,
        },
    )
    return {"pago": pago, "siguiente": siguiente}


@router.post("/pagos/{pago_id}/comprobante", response_model=PagoResponse)
async def subir_comprobante_pago(
    pago_id: int,
    comprobante: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    usuario: dict = Depends(get_usuario),
):
    requerir_admin(usuario)
    contenido = await comprobante.read()
    try:
        pago = await service.subir_comprobante_pago(db, pago_id, comprobante.filename or "comprobante", contenido)
    except ValueError as e:
        msg = str(e)
        code = 400 if "permitido" in msg.lower() or "MB" in msg else 404
        raise HTTPException(status_code=code, detail=msg)
    await log_accion(
        db=db, usuario=usuario, accion="CREAR", modulo="pagos_empresa",
        entidad="comprobante", entidad_id=str(pago_id),
        descripcion=f"Comprobante subido al pago {pago_id}",
        datos_extra={"filename": comprobante.filename, "size_bytes": len(contenido)},
    )
    return pago
