import os
from fastapi import APIRouter, Query, Depends, Body, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse
from typing import Optional
from io import BytesIO
from sqlalchemy.ext.asyncio import AsyncSession
from db.session import get_db
from core.dependencies import get_usuario
from modules.auditlog.service import log_accion
from modules.finanzas.service import (
    get_cobros_semana, get_cobros_dia, toggle_verificacion,
    get_log_cobranza, registrar_pago, get_pagos_dia,
    get_alertas_cobranza, pagar_factura_wisphub, get_recoleccion,
    guardar_estado_equipo, get_historial_pagos, upload_comprobante, get_tecnicos,
    get_formas_pago, get_observaciones_batch, upsert_observacion,
    get_reporte_semanal_data, generar_excel_reporte, generar_pdf_reporte,
)

router = APIRouter()


# ── Lectura (sin log) ────────────────────────────────────────────────────────

@router.get("/cobros-semana")
async def cobros_semana(fecha_inicio: Optional[str] = Query(None)):
    return await get_cobros_semana(fecha_inicio)


@router.get("/cobros-dia")
async def cobros_dia(
    fecha: Optional[str] = Query(None),
    fecha_fin: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    return await get_cobros_dia(fecha, fecha_fin, db)


@router.get("/alertas-cobranza")
async def alertas_cobranza():
    return await get_alertas_cobranza()


@router.get("/log-cobranza")
async def log_cobranza(fecha: Optional[str] = Query(None), db: AsyncSession = Depends(get_db)):
    return await get_log_cobranza(fecha, db)


@router.get("/pagos")
async def pagos_dia(fecha: Optional[str] = Query(None), db: AsyncSession = Depends(get_db)):
    return await get_pagos_dia(fecha, db)


@router.get("/observaciones/{entity_type}")
async def get_observaciones(entity_type: str, ids: str = Query(...), db: AsyncSession = Depends(get_db)):
    id_list = [int(i) for i in ids.split(",") if i.strip().isdigit()]
    return await get_observaciones_batch(entity_type, id_list, db)


@router.get("/formas-pago")
async def formas_pago():
    return await get_formas_pago()


@router.get("/tecnicos")
async def tecnicos():
    return await get_tecnicos()


@router.get("/recoleccion")
async def recoleccion(db: AsyncSession = Depends(get_db)):
    return await get_recoleccion(db)


@router.get("/reporte-semanal")
async def reporte_semanal_json(
    fecha_inicio: str = Query(...),
    fecha_fin: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    return await get_reporte_semanal_data(fecha_inicio, fecha_fin, db)


@router.get("/reporte-semanal/excel")
async def reporte_semanal_excel(
    fecha_inicio: str = Query(...),
    fecha_fin: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    data = await get_reporte_semanal_data(fecha_inicio, fecha_fin, db)
    xlsx_bytes = generar_excel_reporte(data)
    filename = f"reporte_{fecha_inicio}_{fecha_fin}.xlsx"
    return StreamingResponse(
        BytesIO(xlsx_bytes),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/reporte-semanal/pdf")
async def reporte_semanal_pdf(
    fecha_inicio: str = Query(...),
    fecha_fin: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    data = await get_reporte_semanal_data(fecha_inicio, fecha_fin, db)
    pdf_bytes = generar_pdf_reporte(data)
    filename = f"reporte_{fecha_inicio}_{fecha_fin}.pdf"
    return StreamingResponse(
        BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/historial")
async def historial_pagos(search: Optional[str] = Query(None), db: AsyncSession = Depends(get_db)):
    return await get_historial_pagos(db, search)


# ── Mutaciones con log de auditoría ─────────────────────────────────────────

@router.patch("/cobros-dia/{id_factura}/verificar")
async def verificar_pago(
    id_factura: int,
    notas: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    usuario: dict = Depends(get_usuario),
):
    result = await toggle_verificacion(id_factura, notas, db)
    verificado = result.get("verificado", True)
    await log_accion(
        db, usuario,
        accion="VERIFICAR",
        modulo="finanzas",
        entidad="verificacion_pago",
        entidad_id=str(id_factura),
        descripcion=f"Pago de factura #{id_factura} marcado como {'verificado' if verificado else 'no verificado'}",
        datos_extra={"id_factura": id_factura, "verificado": verificado, "notas": notas},
    )
    return result




@router.post("/pagos")
async def crear_pago(
    data: dict = Body(...),
    db: AsyncSession = Depends(get_db),
    usuario: dict = Depends(get_usuario),
):
    result = await registrar_pago(data, db)
    await log_accion(
        db, usuario,
        accion="CREAR",
        modulo="finanzas",
        entidad="pago",
        entidad_id=str(result.get("id")),
        descripcion=(
            f"Pago registrado — Cliente #{data.get('id_cliente')} — "
            f"${data.get('monto', 0)} — {data.get('metodo_pago', 'no_especificado')}"
        ),
        datos_extra={
            "id_cliente": data.get("id_cliente"),
            "id_factura": data.get("id_factura"),
            "monto": data.get("monto"),
            "metodo_pago": data.get("metodo_pago"),
        },
    )
    return result


@router.post("/registrar-pago/{id_factura}")
async def registrar_pago_wisphub(
    id_factura: int,
    data: dict = Body(...),
    db: AsyncSession = Depends(get_db),
    usuario: dict = Depends(get_usuario),
):
    try:
        result = await pagar_factura_wisphub(id_factura, data, db)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        print(f"[ERROR registrar-pago #{id_factura}]: {e}")
        raise HTTPException(status_code=500, detail="Error interno al registrar el pago.")

    await log_accion(
        db, usuario,
        accion="CREAR",
        modulo="finanzas",
        entidad="pago_wisphub",
        entidad_id=str(id_factura),
        descripcion=(
            f"Pago registrado en WispHub — Factura #{id_factura} — "
            f"${data.get('monto', 0)} — Cliente: {data.get('nombre_cliente', '')}"
        ),
        datos_extra={
            "id_factura": id_factura,
            "monto": data.get("monto"),
            "forma_pago": data.get("forma_pago"),
            "nombre_cliente": data.get("nombre_cliente"),
            "id_servicio": data.get("id_servicio"),
        },
    )
    return result


@router.put("/observaciones/{entity_type}/{entity_id}")
async def save_observacion(
    entity_type: str,
    entity_id: int,
    data: dict = Body(...),
    db: AsyncSession = Depends(get_db),
    usuario: dict = Depends(get_usuario),
):
    notas = data.get("notas", "")
    result = await upsert_observacion(entity_type, entity_id, notas, db)
    await log_accion(
        db, usuario,
        accion="ACTUALIZAR",
        modulo="observaciones",
        entidad=entity_type,
        entidad_id=str(entity_id),
        descripcion=f"Observación actualizada — {entity_type} #{entity_id}",
        datos_extra={"entity_type": entity_type, "entity_id": entity_id, "notas": notas},
    )
    return result


@router.post("/pagos/{pago_id}/comprobante")
async def subir_comprobante(
    pago_id: int,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    usuario: dict = Depends(get_usuario),
):
    allowed = {".jpg", ".jpeg", ".png", ".pdf", ".webp"}
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in allowed:
        raise HTTPException(status_code=400, detail="Formato no permitido. Usa JPG, PNG o PDF.")
    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="El archivo no puede superar 10 MB.")
    result = await upload_comprobante(pago_id, file.filename, content, db)
    await log_accion(
        db, usuario,
        accion="CREAR",
        modulo="finanzas",
        entidad="comprobante",
        entidad_id=str(pago_id),
        descripcion=f"Comprobante subido — Pago #{pago_id} — {file.filename}",
        datos_extra={"pago_id": pago_id, "filename": file.filename, "size_bytes": len(content)},
    )
    return result


@router.post("/recoleccion/{id_servicio}/estado-equipo")
async def estado_equipo(
    id_servicio: int,
    data: dict = Body(...),
    db: AsyncSession = Depends(get_db),
    usuario: dict = Depends(get_usuario),
):
    result = await guardar_estado_equipo(id_servicio, data, db)
    await log_accion(
        db, usuario,
        accion="ACTUALIZAR",
        modulo="recoleccion",
        entidad="estado_equipo",
        entidad_id=str(id_servicio),
        descripcion=(
            f"Estado de equipo actualizado — Servicio #{id_servicio} — "
            f"{data.get('estado_equipo', '')} — Técnico: {data.get('nombre_tecnico', 'N/A')}"
        ),
        datos_extra={
            "id_servicio": id_servicio,
            "estado_equipo": data.get("estado_equipo"),
            "id_tecnico": data.get("id_tecnico"),
            "nombre_tecnico": data.get("nombre_tecnico"),
        },
    )
    return result
