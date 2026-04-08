import asyncio
from datetime import date, datetime, timedelta
import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from core.config import settings
from core.wisphub.client import wisphub_client
from modules.finanzas.models import VerificacionPago, LogRecordatorio, PagoRegistrado, RecoleccionRegistro  # noqa: F401
from modules.whatsapp.service import send_recordatorio_dia, send_notificacion_corte

GRAPH_URL = "https://graph.facebook.com/v19.0"


def _week_range(fecha_inicio: str | None = None) -> tuple[date, date]:
    if fecha_inicio:
        base = date.fromisoformat(fecha_inicio)
        start = base - timedelta(days=base.weekday())  # Monday of that week
    else:
        today = date.today()
        start = today - timedelta(days=today.weekday())  # Monday
    end = start + timedelta(days=6)  # Sunday
    return start, end


def _tipo_cobro(articulos: list) -> str:
    for art in articulos:
        desc = (art.get("descripcion") or "").lower()
        if "instalaci" in desc:
            return "instalacion"
    return "mensualidad"


async def get_cobros_semana(fecha_inicio: str | None = None) -> dict:
    start, end = _week_range(fecha_inicio)
    start_str = start.isoformat()
    end_str = end.isoformat()

    data = await wisphub_client.get("/api/facturas/", params={"page_size": 1000})

    items = []
    total_monto = 0.0
    total_pagado = 0.0
    total_pendiente = 0.0

    for f in data.get("results", []):
        emision = (f.get("fecha_emision") or "")[:10]
        if not (start_str <= emision <= end_str):
            continue

        monto = float(f.get("total") or 0)
        estado = f.get("estado", "")
        articulos = f.get("articulos", [])
        cliente = f.get("cliente") or {}

        total_monto += monto
        if estado == "Pagada":
            total_pagado += monto
        else:
            total_pendiente += monto

        items.append({
            "id_factura": f["id_factura"],
            "fecha_emision": emision,
            "fecha_vencimiento": (f.get("fecha_vencimiento") or "")[:10],
            "estado": estado,
            "total": monto,
            "tipo_cobro": _tipo_cobro(articulos),
            "cliente": {
                "nombre": cliente.get("nombre", "—"),
                "telefono": cliente.get("telefono", "—"),
                "direccion": cliente.get("direccion", "—"),
            },
        })

    items.sort(key=lambda x: (0 if x["estado"] == "Pendiente de Pago" else 1, x["fecha_vencimiento"]))

    return {
        "semana_inicio": start_str,
        "semana_fin": end_str,
        "count": len(items),
        "total_monto": round(total_monto, 2),
        "total_pagado": round(total_pagado, 2),
        "total_pendiente": round(total_pendiente, 2),
        "items": items,
    }


def _metodo_pago(f: dict) -> str:
    raw = f.get("metodo_pago") or f.get("forma_pago") or ""
    value = str(raw).strip().lower()
    return value if value else "no_especificado"


async def get_cobros_dia(fecha: str | None = None, db: AsyncSession | None = None) -> dict:
    fecha_str = fecha or date.today().isoformat()

    data = await wisphub_client.get("/api/facturas/", params={"page_size": 1000})

    # Cargar verificaciones locales (Banxico)
    verificaciones: dict[int, bool] = {}
    if db is not None:
        result = await db.execute(select(VerificacionPago))
        for v in result.scalars().all():
            verificaciones[v.id_factura] = v.verificado

    lista_clientes = []
    monto_total_cobrado = 0.0

    for f in data.get("results", []):
        emision = (f.get("fecha_emision") or "")[:10]
        if emision != fecha_str:
            continue

        id_factura = f["id_factura"]
        monto = float(f.get("total") or 0)
        estado = f.get("estado", "")
        # verificado viene de la DB local (Banxico), no de WispHub
        verificado = verificaciones.get(id_factura, False)
        articulos = f.get("articulos", [])
        cliente = f.get("cliente") or {}

        if verificado:
            monto_total_cobrado += monto

        lista_clientes.append({
            "id_factura": id_factura,
            "fecha_pago": emision,
            "estado": estado,
            "verificado": verificado,
            "monto_individual": monto,
            "metodo_pago": _metodo_pago(f),
            "tipo_cobro": _tipo_cobro(articulos),
            "cliente": {
                "nombre": cliente.get("nombre", "—"),
                "telefono": cliente.get("telefono", "—"),
                "direccion": cliente.get("direccion", "—"),
            },
        })

    lista_clientes.sort(key=lambda x: (0 if x["verificado"] else 1, x["id_factura"]))

    return {
        "fecha": fecha_str,
        "numero_total_pagos": len(lista_clientes),
        "monto_total_cobrado": round(monto_total_cobrado, 2),
        "lista_clientes": lista_clientes,
    }


async def toggle_verificacion(id_factura: int, notas: str | None, db: AsyncSession) -> dict:
    result = await db.execute(
        select(VerificacionPago).where(VerificacionPago.id_factura == id_factura)
    )
    registro = result.scalar_one_or_none()

    if registro is None:
        registro = VerificacionPago(
            id_factura=id_factura,
            verificado=True,
            fecha_verificacion=datetime.utcnow(),
            notas=notas,
        )
        db.add(registro)
    else:
        registro.verificado = not registro.verificado
        registro.fecha_verificacion = datetime.utcnow() if registro.verificado else None
        registro.notas = notas if notas is not None else registro.notas

    await db.commit()
    return {
        "id_factura": id_factura,
        "verificado": registro.verificado,
        "fecha_verificacion": registro.fecha_verificacion.isoformat() if registro.fecha_verificacion else None,
        "notas": registro.notas,
    }


async def ejecutar_flujo_cobranza(db: AsyncSession) -> dict:
    today = date.today()

    data = await wisphub_client.get("/api/facturas/", params={"page_size": 1000, "estado": "Pendiente de Pago"})
    facturas = data.get("results", [])
    # Deduplicación: evitar reenvíos si el cron ejecuta más de una vez al día
    inicio_hoy = datetime.combine(today, datetime.min.time())
    fin_hoy = datetime.combine(today, datetime.max.time())
    log_result = await db.execute(
        select(LogRecordatorio).where(
            LogRecordatorio.fecha_envio >= inicio_hoy,
            LogRecordatorio.fecha_envio <= fin_hoy,
        )
    )
    ya_enviados: set[tuple[int, int]] = {
        (r.id_factura, r.dia_tolerancia) for r in log_result.scalars().all()
    }

    grupos: dict[int, list] = {1: [], 2: [], 3: [], 4: []}
    for f in facturas:
        venc_str = (f.get("fecha_vencimiento") or "")[:10]
        if not venc_str:
            continue
        dias = (today - date.fromisoformat(venc_str)).days
        if 1 <= dias <= 4:
            grupos[dias].append(f)

    acciones = {"recordatorios_enviados": 0, "cortes_ejecutados": 0, "errores": 0}

    # Días 1-3: recordatorios en paralelo — un fallo no cancela los demás
    for dia in (1, 2, 3):
        pendientes = [
            f for f in grupos[dia]
            if (f["id_factura"], dia) not in ya_enviados
            and (f.get("cliente") or {}).get("telefono", "").strip()
        ]
        if not pendientes:
            continue

        tareas = [
            send_recordatorio_dia(
                (f.get("cliente") or {})["telefono"].strip(),
                (f.get("cliente") or {}).get("nombre", ""),
                dia,
                (f.get("fecha_vencimiento") or "")[:10],
                float(f.get("total") or 0),
            )
            for f in pendientes
        ]
        resultados = await asyncio.gather(*tareas, return_exceptions=True)

        for f, resultado in zip(pendientes, resultados):
            exitoso = not isinstance(resultado, Exception)
            db.add(LogRecordatorio(
                id_cliente=str((f.get("cliente") or {}).get("id", "")),
                id_factura=f["id_factura"],
                dia_tolerancia=dia,
                exitoso=exitoso,
                respuesta_api=str(resultado)[:500] if isinstance(resultado, Exception) else None,
            ))
            acciones["recordatorios_enviados" if exitoso else "errores"] += 1

    # Día 4: corte de servicio (secuencial — aislamiento de errores por cliente)
    for f in grupos[4]:
        if (f["id_factura"], 4) in ya_enviados:
            continue
        cliente = f.get("cliente") or {}
        id_servicio = str(cliente.get("id", ""))
        tel = (cliente.get("telefono") or "").strip()
        exitoso = False
        respuesta = ""
        try:
                result = await wisphub_client.post(
                "/api/clientes/desactivar/",
                payload={"servicios": [int(id_servicio)]}
            )
                exitoso = "task_id" in result
                respuesta = str(result.get("task_id", ""))
        except Exception as exc:
            respuesta = str(exc)[:500]

        if tel:
            try:
                await send_notificacion_corte(tel, cliente.get("nombre", ""))
            except Exception:
                pass

        db.add(LogRecordatorio(
            id_cliente=id_servicio,
            id_factura=f["id_factura"],
            dia_tolerancia=4,
            exitoso=exitoso,
            respuesta_api=respuesta or None,
        ))
        acciones["cortes_ejecutados" if exitoso else "errores"] += 1

    await db.commit()
    return acciones


async def get_alertas_cobranza() -> dict:
    today = date.today()

    clientes_data, facturas_data = await asyncio.gather(
        wisphub_client.get("/api/clientes/", params={"page_size": 1000}),
        wisphub_client.get("/api/facturas/", params={"page_size": 1000}),
    )

    # Mapa id_servicio → datos del cliente
    clientes: dict[int, dict] = {}
    for c in clientes_data.get("results", []):
        sid = c.get("id_servicio")
        if sid:
            clientes[sid] = c

    # Mapa id_servicio → fecha_vencimiento más próxima de facturas pendientes
    vmap: dict[int, date] = {}
    vmap_factura: dict[int, int] = {}
    vmap_total: dict[int, float] = {}
    for f in facturas_data.get("results", []):
        if f.get("estado") != "Pendiente de Pago":
            continue
        fv_str = (f.get("fecha_vencimiento") or "")[:10]
        if not fv_str:
            continue
        try:
            fv = date.fromisoformat(fv_str)
        except ValueError:
            continue
        for art in f.get("articulos", []):
            srv_id = (art.get("servicio") or {}).get("id_servicio")
            if srv_id and (srv_id not in vmap or fv < vmap[srv_id]):
                vmap[srv_id] = fv
                vmap_factura[srv_id] = f["id_factura"]
                vmap_total[srv_id] = float(f.get("total") or 0)

    grupos: dict[str, list] = {"dia_1": [], "dia_2": [], "dia_3": [], "mas_de_3": []}

    for srv_id, fv in vmap.items():
        dias = (today - fv).days
        if dias <= 0:
            continue  # aún no vencido

        c = clientes.get(srv_id, {})
        item = {
            "id_servicio": srv_id,
            "nombre": c.get("nombre", "—"),
            "telefono": c.get("telefono", "—"),
            "estado": c.get("estado", "—"),
            "fecha_corte": fv.isoformat(),
            "dias_vencido": dias,
            "id_factura": vmap_factura.get(srv_id),
            "total": vmap_total.get(srv_id),
        }

        if dias == 1:
            grupos["dia_1"].append(item)
        elif dias == 2:
            grupos["dia_2"].append(item)
        elif dias == 3:
            grupos["dia_3"].append(item)
        else:
            grupos["mas_de_3"].append(item)

    for g in grupos.values():
        g.sort(key=lambda x: x["nombre"])

    return {
        "total": sum(len(v) for v in grupos.values()),
        "dia_1":     {"count": len(grupos["dia_1"]),     "items": grupos["dia_1"]},
        "dia_2":     {"count": len(grupos["dia_2"]),     "items": grupos["dia_2"]},
        "dia_3":     {"count": len(grupos["dia_3"]),     "items": grupos["dia_3"]},
        "mas_de_3":  {"count": len(grupos["mas_de_3"]), "items": grupos["mas_de_3"]},
    }


async def get_log_cobranza(fecha: str | None, db: AsyncSession) -> dict:
    fecha_str = fecha or date.today().isoformat()
    inicio = datetime.combine(date.fromisoformat(fecha_str), datetime.min.time())
    fin = datetime.combine(date.fromisoformat(fecha_str), datetime.max.time())
    result = await db.execute(
        select(LogRecordatorio)
        .where(LogRecordatorio.fecha_envio >= inicio, LogRecordatorio.fecha_envio <= fin)
        .order_by(LogRecordatorio.id.desc())
    )
    logs = result.scalars().all()
    return {
        "fecha": fecha_str,
        "total": len(logs),
        "items": [
            {
                "id": r.id,
                "id_cliente": r.id_cliente,
                "id_factura": r.id_factura,
                "dia_tolerancia": r.dia_tolerancia,
                "fecha_envio": r.fecha_envio.isoformat(),
                "exitoso": r.exitoso,
                "respuesta_api": r.respuesta_api,
            }
            for r in logs
        ],
    }


async def registrar_pago(data: dict, db: AsyncSession) -> dict:
    pago = PagoRegistrado(
        id_cliente=data["id_cliente"],
        id_factura=data.get("id_factura"),
        monto=data["monto"],
        metodo_pago=data.get("metodo_pago", "no_especificado"),
        notas=data.get("notas"),
        fecha_pago=datetime.utcnow(),
    )
    db.add(pago)
    await db.commit()
    await db.refresh(pago)
    return {
        "id": pago.id,
        "id_cliente": pago.id_cliente,
        "id_factura": pago.id_factura,
        "monto": pago.monto,
        "fecha_pago": pago.fecha_pago.isoformat(),
        "metodo_pago": pago.metodo_pago,
        "verificado": pago.verificado,
        "notas": pago.notas,
    }


async def get_pagos_dia(fecha: str | None, db: AsyncSession) -> dict:
    fecha_str = fecha or date.today().isoformat()
    inicio = datetime.combine(date.fromisoformat(fecha_str), datetime.min.time())
    fin = datetime.combine(date.fromisoformat(fecha_str), datetime.max.time())
    result = await db.execute(
        select(PagoRegistrado)
        .where(PagoRegistrado.fecha_pago >= inicio, PagoRegistrado.fecha_pago <= fin)
        .order_by(PagoRegistrado.id.desc())
    )
    pagos = result.scalars().all()
    return {
        "fecha": fecha_str,
        "total": len(pagos),
        "items": [
            {
                "id": p.id,
                "id_cliente": p.id_cliente,
                "id_factura": p.id_factura,
                "monto": p.monto,
                "fecha_pago": p.fecha_pago.isoformat(),
                "metodo_pago": p.metodo_pago,
                "verificado": p.verificado,
                "notas": p.notas,
            }
            for p in pagos
        ],
    }

async def pagar_factura_wisphub(id_factura: int, data: dict) -> dict:
    from datetime import datetime
    fecha_pago = data.get("fecha_pago") or datetime.now().strftime("%Y-%m-%d %H:%M")
    payload = {
        "accion": "1",
        "forma_pago": data["forma_pago"],
        "total_cobrado": data["monto"],
        "fecha_pago": fecha_pago,
    }
    return await wisphub_client.post(
        f"/api/facturas/{id_factura}/registrar-pago/",
        payload=payload,
    )

async def get_recoleccion(db: AsyncSession) -> dict:
    from sqlalchemy import select
    today = date.today()

    clientes_data, facturas_data = await asyncio.gather(
        wisphub_client.get("/api/clientes/", params={"page_size": 1000}),
        wisphub_client.get("/api/facturas/", params={"page_size": 1000}),
    )

    clientes: dict[int, dict] = {}
    for c in clientes_data.get("results", []):
        sid = c.get("id_servicio")
        if sid:
            clientes[sid] = c

    vmap: dict[int, dict] = {}
    for f in facturas_data.get("results", []):
        if f.get("estado") != "Pendiente de Pago":
            continue
        fv_str = (f.get("fecha_vencimiento") or "")[:10]
        if not fv_str:
            continue
        try:
            fv = date.fromisoformat(fv_str)
        except ValueError:
            continue
        dias = (today - fv).days
        if dias < 7:
            continue
        for art in f.get("articulos", []):
            srv_id = (art.get("servicio") or {}).get("id_servicio")
            if srv_id and (srv_id not in vmap or fv < date.fromisoformat(vmap[srv_id]["fecha_vencimiento"])):
                vmap[srv_id] = {
                    "id_factura": f["id_factura"],
                    "fecha_vencimiento": fv_str,
                    "dias_vencido": dias,
                    "total": float(f.get("total") or 0),
                }

    items = []
    for srv_id, fdata in vmap.items():
        c = clientes.get(srv_id, {})
        if c.get("estado") == "Cancelado":
            continue
        items.append({
            "id_servicio": srv_id,
            "id_factura": fdata["id_factura"],
            "nombre": c.get("nombre", "—"),
            "direccion": c.get("direccion", "—"),
            "telefono": c.get("telefono", "—"),
            "estado": c.get("estado", "—"),
            "fecha_vencimiento": fdata["fecha_vencimiento"],
            "dias_vencido": fdata["dias_vencido"],
            "total": fdata["total"],
        })

    items.sort(key=lambda x: x["dias_vencido"], reverse=True)

    ids = [item["id_servicio"] for item in items]
    if ids:
        result = await db.execute(
            select(RecoleccionRegistro).where(RecoleccionRegistro.id_servicio.in_(ids))
        )
        registros = {r.id_servicio: r for r in result.scalars().all()}
    else:
        registros = {}

    for item in items:
        reg = registros.get(item["id_servicio"])
        item["estado_equipo"] = reg.estado_equipo if reg else None
        item["notas"] = reg.notas if reg else None

    return {
        "total": len(items),
        "items": items,
    }

async def guardar_estado_equipo(id_servicio: int, data: dict, db: AsyncSession) -> dict:
    from sqlalchemy import select
    result = await db.execute(
        select(RecoleccionRegistro).where(RecoleccionRegistro.id_servicio == id_servicio)
    )
    registro = result.scalar_one_or_none()

    estado = data.get("estado_equipo", "nada_recuperado")
    notas = data.get("notas")

    if registro is None:
        registro = RecoleccionRegistro(
            id_servicio=id_servicio,
            estado_equipo=estado,
            notas=notas,
        )
        db.add(registro)
    else:
        registro.estado_equipo = estado
        registro.notas = notas
        registro.updated_at = datetime.utcnow()

    await db.commit()
    await db.refresh(registro)
    return {
        "id_servicio": id_servicio,
        "estado_equipo": registro.estado_equipo,
        "notas": registro.notas,
        "fecha_registro": registro.fecha_registro.isoformat() if registro.fecha_registro else None,
    }