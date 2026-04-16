import asyncio
import os
import uuid
from datetime import date, datetime, timedelta
import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from core.config import settings
from core.wisphub.client import wisphub_client
from modules.finanzas.models import VerificacionPago, LogRecordatorio, PagoRegistrado, RecoleccionRegistro, Observacion  # noqa: F401

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

        id_servicio = next(
            (art.get("servicio", {}).get("id_servicio") for art in articulos if art.get("servicio")),
            None
        )
        items.append({
            "id_factura": f["id_factura"],
            "fecha_emision": emision,
            "fecha_vencimiento": (f.get("fecha_vencimiento") or "")[:10],
            "estado": estado,
            "total": monto,
            "tipo_cobro": _tipo_cobro(articulos),
            "cliente": {
                "id_servicio": id_servicio,
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


async def get_cobros_dia(fecha: str | None = None, fecha_fin: str | None = None, db: AsyncSession | None = None) -> dict:
    fecha_str = fecha or date.today().isoformat()
    fecha_fin_str = fecha_fin or fecha_str

    data = await wisphub_client.get("/api/facturas/", params={"page_size": 1000})

    verificaciones: dict[int, bool] = {}
    if db is not None:
        result = await db.execute(select(VerificacionPago))
        for v in result.scalars().all():
            verificaciones[v.id_factura] = v.verificado

    lista_clientes = []
    monto_total_cobrado = 0.0

    for f in data.get("results", []):
        emision = (f.get("fecha_emision") or "")[:10]
        if not (fecha_str <= emision <= fecha_fin_str):
            continue

        id_factura = f["id_factura"]
        monto = float(f.get("total") or 0)
        estado = f.get("estado", "")
        verificado = verificaciones.get(id_factura, False)
        articulos = f.get("articulos", [])
        cliente = f.get("cliente") or {}

        if verificado or estado == "Pagada":
            monto_total_cobrado += monto

        id_servicio = next(
            (art.get("servicio", {}).get("id_servicio") for art in articulos if art.get("servicio")),
            None
        )
        lista_clientes.append({
            "id_factura": id_factura,
            "fecha_pago": emision,
            "estado": estado,
            "verificado": verificado,
            "monto_individual": monto,
            "metodo_pago": _metodo_pago(f),
            "tipo_cobro": _tipo_cobro(articulos),
            "cliente": {
                "id_servicio": id_servicio,
                "nombre": cliente.get("nombre", "—"),
                "telefono": cliente.get("telefono", "—"),
                "direccion": cliente.get("direccion", "—"),
            },
        })

    lista_clientes.sort(key=lambda x: (0 if x["verificado"] else 1, x["fecha_pago"]))

    return {
        "fecha": fecha_str,
        "fecha_fin": fecha_fin_str,
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

    grupos: dict[int, list] = {0: [], 1: [], 2: [], 3: [], 4: []}
    for f in facturas:
        venc_str = (f.get("fecha_vencimiento") or "")[:10]
        if not venc_str:
            continue
        dias = (today - date.fromisoformat(venc_str)).days
        if 0 <= dias <= 4:
            grupos[dias].append(f)

    acciones = {"recordatorios_enviados": 0, "cortes_ejecutados": 0, "errores": 0}

    # Días 1-3: recordatorios en paralelo — un fallo no cancela los demás
    for dia in (0, 1, 2, 3):
        pendientes = [
            f for f in grupos[dia]
            if (f["id_factura"], dia) not in ya_enviados
            and (f.get("cliente") or {}).get("telefono", "").strip()
        ]
        if not pendientes:
            continue

        for f in pendientes:
            db.add(LogRecordatorio(
                id_cliente=str((f.get("cliente") or {}).get("id", "")),
                id_factura=f["id_factura"],
                dia_tolerancia=dia,
                exitoso=True,
                respuesta_api=None,
            ))
            acciones["recordatorios_enviados"] += 1

    # Día 4: corte de servicio (secuencial — aislamiento de errores por cliente)
    if tel:
            try:
                await send_notificacion_corte(tel, cliente.get("nombre", ""), float(f.get("total") or 0))
            except Exception:
                pass

    await db.commit()
    return acciones


async def preview_recordatorios(db: AsyncSession) -> dict:
    """Devuelve cuántos mensajes se enviarían por día sin ejecutar nada."""
    today = date.today()
    data = await wisphub_client.get("/api/facturas/", params={"page_size": 1000, "estado": "Pendiente de Pago"})
    facturas = data.get("results", [])

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

    grupos: dict[int, list] = {0: [], 1: [], 2: [], 3: [], 4: []}
    for f in facturas:
        venc_str = (f.get("fecha_vencimiento") or "")[:10]
        if not venc_str:
            continue
        try:
            dias = (today - date.fromisoformat(venc_str)).days
        except ValueError:
            continue
        if 0 <= dias <= 4:
            tel = ((f.get("cliente") or {}).get("telefono") or "").strip()
            if tel and (f["id_factura"], dias) not in ya_enviados:
                grupos[dias].append(f)

    return {
        "dia_0": {"count": len(grupos[0]), "label": "Vencen hoy"},
        "dia_1": {"count": len(grupos[1]), "label": "1 día vencido"},
        "dia_2": {"count": len(grupos[2]), "label": "2 días vencido"},
        "dia_3": {"count": len(grupos[3]), "label": "3 días vencido"},
        "dia_4": {"count": len(grupos[4]), "label": "4 días vencido — suspensión"},
        "total": sum(len(g) for g in grupos.values()),
    }


async def get_alertas_cobranza() -> dict:
    today = date.today()

    clientes_data, facturas_data = await asyncio.gather(
        wisphub_client.get("/api/clientes/", params={"page_size": 1000}),
        wisphub_client.get("/api/facturas/", params={"page_size": 1000}),
    )

    # Mapa id_servicio → datos del cliente (solo Activo y Suspendido, no Cancelado)
    clientes: dict[int, dict] = {}
    for c in clientes_data.get("results", []):
        sid = c.get("id_servicio")
        if sid and c.get("estado") != "Cancelado":
            clientes[sid] = c

    # Mapa id_servicio → factura pendiente más próxima.
    # Usamos fecha_vencimiento (= día de corte en WispHub) solo para ordenar y elegir
    # la factura más urgente. Para calcular días vencidos usamos fecha_pago (= día de pago).
    vmap: dict[int, date] = {}           # fecha_vencimiento — para ordenar
    pmap: dict[int, date] = {}           # fecha_pago — referencia real de días vencidos
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
                # fecha_pago de la factura es el día que el cliente debe pagar.
                # WispHub devuelve fecha_pago en formato "DD/MM/YYYY HH:MM:SS",
                # distinto al formato ISO de fecha_vencimiento.
                fp_raw = (f.get("fecha_pago") or "").strip()
                fp_date: date | None = None
                if fp_raw:
                    for fmt in ("%d/%m/%Y %H:%M:%S", "%d/%m/%Y %H:%M", "%d/%m/%Y", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d"):
                        try:
                            fp_date = datetime.strptime(fp_raw[:19], fmt).date()
                            break
                        except ValueError:
                            continue
                pmap[srv_id] = fp_date if fp_date else fv

    grupos: dict[str, list] = {"hoy": [], "dia_1": [], "dia_2": [], "dia_3": [], "mas_de_3": []}

    for srv_id, fv in vmap.items():
        # Usar fecha_pago como referencia; si no existe, caer a fecha_vencimiento
        fecha_pago = pmap.get(srv_id, fv)
        dias = (today - fecha_pago).days
        if dias < 0:
            continue  # aún no vencido

        c = clientes.get(srv_id)
        if not c:
            continue  # servicio sin cliente activo/suspendido, se omite
        item = {
            "id_servicio": srv_id,
            "nombre": c.get("nombre", "—"),
            "telefono": c.get("telefono", "—"),
            "estado": c.get("estado", "—"),
            "fecha_vencimiento": fecha_pago.isoformat(),
            "dias_vencido": dias,
            "id_factura": vmap_factura.get(srv_id),
            "total": vmap_total.get(srv_id),
        }

        if dias == 0:
            grupos["hoy"].append(item)
        elif dias == 1:
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
        "hoy":       {"count": len(grupos["hoy"]),       "items": grupos["hoy"]},
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

_FORMAS_PAGO_NOMBRES: dict[int, str] = {
    82219: "Efectivo",
    84091: "Tarjeta",
    82222: "Transferencia Bancaria",
}


async def pagar_factura_wisphub(id_factura: int, data: dict, db: AsyncSession | None = None) -> dict:
    fecha_pago = data.get("fecha_pago") or datetime.now().strftime("%Y-%m-%d %H:%M")
    payload = {
        "accion": "1",
        "forma_pago": data["forma_pago"],
        "total_cobrado": data["monto"],
        "fecha_pago": fecha_pago,
    }
    try:
        resultado = await wisphub_client.post(
            f"/api/facturas/{id_factura}/registrar-pago/",
            payload=payload,
        )
    except httpx.HTTPStatusError as e:
        try:
            detalle = e.response.json()
            errores = detalle.get("errors") or detalle.get("detail") or [str(e)]
            mensaje = errores[0] if isinstance(errores, list) else str(errores)
        except Exception:
            mensaje = f"WispHub respondió con error {e.response.status_code}"
        raise ValueError(mensaje) from e
    # El pago ya fue registrado en WispHub — el guardado local es secundario
    if db is not None:
        try:
            fecha_pago_real = None
            if data.get("fecha_pago_real"):
                try:
                    fecha_pago_real = datetime.fromisoformat(data["fecha_pago_real"])
                except ValueError:
                    pass
            tipo_pago = (data.get("tipo_pago") or "").strip()
            cuenta = (data.get("cuenta") or "").strip()
            base = tipo_pago or _FORMAS_PAGO_NOMBRES.get(int(data["forma_pago"]), str(data["forma_pago"]))
            metodo_pago_local = f"{base} - {cuenta}" if cuenta else base
            registro = PagoRegistrado(
                id_cliente=str(data.get("id_servicio", "")),
                nombre_cliente=data.get("nombre_cliente"),
                id_factura=id_factura,
                monto=float(data["monto"]),
                metodo_pago=metodo_pago_local,
                fecha_pago=datetime.utcnow(),
                fecha_pago_real=fecha_pago_real,
            )
            db.add(registro)
            await db.commit()
            await db.refresh(registro)
            resultado["pago_id"] = registro.id
        except Exception as e:
            await db.rollback()
            resultado["pago_id"] = None
            resultado["local_error"] = str(e)
    return resultado

async def get_observaciones_batch(entity_type: str, ids: list[int], db: AsyncSession) -> dict:
    """Devuelve {entity_id: notas} para los IDs solicitados."""
    if entity_type == "recoleccion":
        result = await db.execute(
            select(RecoleccionRegistro).where(RecoleccionRegistro.id_servicio.in_(ids))
        )
        return {r.id_servicio: r.notas for r in result.scalars().all() if r.notas}
    if entity_type == "pago":
        result = await db.execute(
            select(PagoRegistrado).where(PagoRegistrado.id.in_(ids))
        )
        return {r.id: r.notas for r in result.scalars().all() if r.notas}
    result = await db.execute(
        select(Observacion).where(
            Observacion.entity_type == entity_type,
            Observacion.entity_id.in_(ids),
        )
    )
    return {r.entity_id: r.notas for r in result.scalars().all() if r.notas}


async def upsert_observacion(entity_type: str, entity_id: int, notas: str, db: AsyncSession) -> dict:
    """Guarda o actualiza la observación. Rutea al modelo correcto según entity_type."""
    if entity_type == "recoleccion":
        result = await db.execute(
            select(RecoleccionRegistro).where(RecoleccionRegistro.id_servicio == entity_id)
        )
        reg = result.scalar_one_or_none()
        if reg:
            reg.notas = notas or None
            reg.updated_at = datetime.utcnow()
        else:
            reg = RecoleccionRegistro(id_servicio=entity_id, estado_equipo="nada_recuperado", notas=notas or None)
            db.add(reg)
    elif entity_type == "pago":
        result = await db.execute(
            select(PagoRegistrado).where(PagoRegistrado.id == entity_id)
        )
        pago = result.scalar_one_or_none()
        if pago:
            pago.notas = notas or None
    else:
        result = await db.execute(
            select(Observacion).where(
                Observacion.entity_type == entity_type,
                Observacion.entity_id == entity_id,
            )
        )
        obs = result.scalar_one_or_none()
        if obs is None:
            obs = Observacion(entity_type=entity_type, entity_id=entity_id, notas=notas or None)
            db.add(obs)
        else:
            obs.notas = notas or None
            obs.updated_at = datetime.utcnow()
    await db.commit()
    return {"entity_type": entity_type, "entity_id": entity_id, "notas": notas}


async def get_formas_pago() -> list:
    data = await wisphub_client.get("/api/formas-de-pago/")
    return [{"id": f["id"], "nombre": f["nombre"]} for f in data.get("results", [])]


async def get_tecnicos() -> list:
    data = await wisphub_client.get("/api/staff/", params={"page_size": 100})
    return [
        {
            "id": s["id"],
            "nombre": s.get("nombre") or s.get("username", ""),
        }
        for s in data.get("results", [])
    ]


async def get_recoleccion(db: AsyncSession) -> dict:
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
        # Parsear fecha_pago igual que en Cobranza
        fp_raw = (f.get("fecha_pago") or "").strip()
        fp_date: date | None = None
        if fp_raw:
            for fmt in ("%d/%m/%Y %H:%M:%S", "%d/%m/%Y %H:%M", "%d/%m/%Y", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d"):
                try:
                    fp_date = datetime.strptime(fp_raw[:19], fmt).date()
                    break
                except ValueError:
                    continue
        fecha_ref = fp_date if fp_date else fv
        dias = (today - fecha_ref).days
        if dias < 7:
            continue
        for art in f.get("articulos", []):
            srv_id = (art.get("servicio") or {}).get("id_servicio")
            if srv_id and (srv_id not in vmap or fecha_ref < date.fromisoformat(vmap[srv_id]["fecha_vencimiento"])):
                vmap[srv_id] = {
                    "id_factura": f["id_factura"],
                    "fecha_vencimiento": fecha_ref.isoformat(),
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
        item["id_tecnico"] = reg.id_tecnico if reg else None
        item["nombre_tecnico"] = reg.nombre_tecnico if reg else None

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
    id_tecnico = data.get("id_tecnico")
    nombre_tecnico = data.get("nombre_tecnico")

    if registro is None:
        registro = RecoleccionRegistro(
            id_servicio=id_servicio,
            estado_equipo=estado,
            notas=notas,
            id_tecnico=id_tecnico,
            nombre_tecnico=nombre_tecnico,
        )
        db.add(registro)
    else:
        registro.estado_equipo = estado
        registro.notas = notas
        registro.id_tecnico = id_tecnico
        registro.nombre_tecnico = nombre_tecnico
        registro.updated_at = datetime.utcnow()

    await db.commit()
    await db.refresh(registro)
    return {
        "id_servicio": id_servicio,
        "estado_equipo": registro.estado_equipo,
        "notas": registro.notas,
        "id_tecnico": registro.id_tecnico,
        "nombre_tecnico": registro.nombre_tecnico,
        "fecha_registro": registro.fecha_registro.isoformat() if registro.fecha_registro else None,
    }


async def get_historial_pagos(db: AsyncSession, search: str | None = None) -> dict:
    result = await db.execute(select(PagoRegistrado).order_by(PagoRegistrado.fecha_pago.desc()))
    pagos = result.scalars().all()

    if search:
        q = search.lower()
        pagos = [
            p for p in pagos
            if (p.nombre_cliente and q in p.nombre_cliente.lower())
            or q in p.id_cliente
            or (p.id_factura and q in str(p.id_factura))
        ]

    return {
        "total": len(pagos),
        "items": [
            {
                "id": p.id,
                "id_cliente": p.id_cliente,
                "nombre_cliente": p.nombre_cliente,
                "id_factura": p.id_factura,
                "monto": p.monto,
                "metodo_pago": p.metodo_pago,
                "fecha_pago_real": p.fecha_pago_real.isoformat() if p.fecha_pago_real else None,
                "fecha_registro": p.fecha_pago.isoformat(),
                "notas": p.notas,
                "comprobante_url": f"/static/comprobantes/{os.path.basename(p.comprobante_path)}" if p.comprobante_path else None,
            }
            for p in pagos
        ],
    }


async def upload_comprobante(pago_id: int, filename: str, content: bytes, db: AsyncSession) -> dict:
    ext = os.path.splitext(filename)[1].lower()
    safe_name = f"{pago_id}_{uuid.uuid4().hex}{ext}"
    path = os.path.join("data", "comprobantes", safe_name)

    with open(path, "wb") as f:
        f.write(content)

    result = await db.execute(select(PagoRegistrado).where(PagoRegistrado.id == pago_id))
    registro = result.scalar_one_or_none()
    if registro:
        registro.comprobante_path = path
        await db.commit()

    return {"comprobante_url": f"/static/comprobantes/{safe_name}"}