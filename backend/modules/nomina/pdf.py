"""Generación de recibos de nómina en PDF.

Layout: hoja carta dividida horizontalmente en 2 mitades. En cada mitad
cabe un recibo completo. El recibo individual ocupa la mitad superior y
deja la inferior vacía con una línea "— cortar aquí —". El batch del
período empaca 2 empleados distintos por hoja.
"""
from io import BytesIO
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.pdfgen import canvas
from reportlab.lib import colors

from modules.nomina.models import TipoIncidencia
from modules.nomina.schemas import PeriodoDetalle, RegistroResponse


PAGE_W, PAGE_H = letter            # 612 x 792 puntos
HALF_H = PAGE_H / 2                # 396 puntos por recibo
MARGIN = 0.4 * inch
PRIMARY = colors.HexColor("#1e293b")
ACCENT  = colors.HexColor("#2563eb")
MUTED   = colors.HexColor("#64748b")
BORDER  = colors.HexColor("#cbd5e1")
GREEN   = colors.HexColor("#16a34a")
RED     = colors.HexColor("#dc2626")


def _fmt_money(value: float) -> str:
    return f"${value:,.2f}"


def _dibujar_recibo(c: canvas.Canvas, base_y: float, registro: RegistroResponse, periodo: PeriodoDetalle) -> None:
    """Dibuja un recibo dentro de una mitad de hoja. base_y es el borde inferior."""
    x_left  = MARGIN
    x_right = PAGE_W - MARGIN
    width   = x_right - x_left
    y_top   = base_y + HALF_H - MARGIN

    # ── Marco
    c.setStrokeColor(BORDER)
    c.setLineWidth(0.8)
    c.rect(x_left, base_y + MARGIN * 0.5, width, HALF_H - MARGIN, stroke=1, fill=0)

    # ── Encabezado
    c.setFillColor(PRIMARY)
    c.setFont("Helvetica-Bold", 13)
    c.drawString(x_left + 12, y_top - 16, "RECIBO DE NÓMINA — TELNET")
    c.setFont("Helvetica", 9)
    c.setFillColor(MUTED)
    semana_iso = periodo.fecha_inicio.isocalendar()[1]
    c.drawRightString(x_right - 12, y_top - 16,
                      f"Semana {semana_iso} · {periodo.fecha_inicio.strftime('%d/%m/%Y')} – {periodo.fecha_fin.strftime('%d/%m/%Y')}")
    c.setStrokeColor(ACCENT)
    c.setLineWidth(1.2)
    c.line(x_left + 12, y_top - 22, x_right - 12, y_top - 22)

    # ── Datos del empleado
    y = y_top - 38
    c.setFillColor(PRIMARY)
    c.setFont("Helvetica-Bold", 10)
    c.drawString(x_left + 12, y, "Empleado:")
    c.setFont("Helvetica", 10)
    c.drawString(x_left + 80, y, registro.usuario_nombre)
    if registro.area:
        c.setFillColor(MUTED)
        c.setFont("Helvetica-Oblique", 9)
        c.drawRightString(x_right - 12, y, f"Área: {registro.area}")

    # ── Desglose en dos columnas
    y -= 18
    col_l = x_left + 12
    col_r = x_left + width / 2 + 12
    col_w = width / 2 - 24

    sueldo_semanal = registro.sueldo_semanal_aplicado or 0.0
    rows_izq = [
        ("Sueldo semanal",     _fmt_money(sueldo_semanal)),
        ("Días trabajados",    f"{registro.dias_trabajados:g}"),
        ("Importe base",       _fmt_money(registro.importe_base)),
        ("Horas extra",        f"{registro.horas_extra:g} h"),
        ("Monto horas extra",  _fmt_money(registro.monto_horas_extra)),
    ]
    c.setFont("Helvetica", 9.5)
    for i, (label, val) in enumerate(rows_izq):
        yy = y - i * 14
        c.setFillColor(MUTED);   c.drawString(col_l, yy, label)
        c.setFillColor(PRIMARY); c.drawRightString(col_l + col_w, yy, val)

    # ── Lista de incidencias (sin contar HORA_EXTRA porque ya está aparte; ni diferidas)
    incs_visibles = [i for i in registro.incidencias if i.tipo != TipoIncidencia.HORA_EXTRA and not i.diferida]
    c.setFillColor(PRIMARY)
    c.setFont("Helvetica-Bold", 9.5)
    c.drawString(col_r, y, "Percepciones / Deducciones")
    c.setStrokeColor(BORDER)
    c.line(col_r, y - 3, col_r + col_w, y - 3)

    yy = y - 14
    c.setFont("Helvetica", 8.5)
    max_lines = 7
    for inc in incs_visibles[:max_lines]:
        c.setFillColor(MUTED)
        label = inc.descripcion or inc.tipo.value.replace("_", " ").title()
        if len(label) > 38:
            label = label[:36] + "…"
        c.drawString(col_r, yy, label)
        c.setFillColor(GREEN if inc.monto >= 0 else RED)
        c.drawRightString(col_r + col_w, yy, _fmt_money(inc.monto))
        yy -= 11
        # Si es cuota de préstamo, mostrar saldo restante debajo
        if inc.tipo == TipoIncidencia.CUOTA_PRESTAMO and inc.prestamo_saldo_restante is not None:
            c.setFillColor(MUTED)
            c.setFont("Helvetica-Oblique", 7.5)
            c.drawString(col_r + 8, yy, f"Resta por pagar: {_fmt_money(inc.prestamo_saldo_restante)}")
            c.setFont("Helvetica", 8.5)
            yy -= 10
    if len(incs_visibles) > max_lines:
        c.setFillColor(MUTED)
        c.drawString(col_r, yy, f"… y {len(incs_visibles) - max_lines} más")

    # ── Total
    y_total = base_y + 60
    c.setStrokeColor(ACCENT); c.setLineWidth(1.0)
    c.line(x_left + 12, y_total + 16, x_right - 12, y_total + 16)
    c.setFillColor(MUTED); c.setFont("Helvetica", 9)
    c.drawString(x_left + 12, y_total + 4, f"Percepciones extra: {_fmt_money(registro.percepciones_extra)}")
    c.drawString(x_left + 200, y_total + 4, f"Deducciones: {_fmt_money(registro.deducciones)}")
    c.setFillColor(PRIMARY); c.setFont("Helvetica-Bold", 13)
    c.drawRightString(x_right - 12, y_total + 4, f"TOTAL A PAGAR: {_fmt_money(registro.total_a_pagar)}")

    # ── Firma
    y_firma = base_y + 26
    c.setStrokeColor(PRIMARY); c.setLineWidth(0.6)
    c.line(x_left + 60, y_firma, x_left + 280, y_firma)
    c.setFillColor(MUTED); c.setFont("Helvetica", 8)
    c.drawString(x_left + 60, y_firma - 10,
                 "Recibí el importe total a mi entera conformidad por concepto de salario")
    c.drawString(x_left + 60, y_firma - 20,
                 "y prestaciones del período indicado.")
    c.setFont("Helvetica-Oblique", 8)
    c.drawCentredString(x_left + 170, y_firma + 4, registro.usuario_nombre.upper())


def _dibujar_linea_corte(c: canvas.Canvas) -> None:
    """Línea punteada horizontal en el medio de la hoja para indicar corte."""
    c.setStrokeColor(MUTED)
    c.setDash(3, 3)
    c.setLineWidth(0.5)
    c.line(MARGIN, HALF_H, PAGE_W - MARGIN, HALF_H)
    c.setDash()
    c.setFillColor(MUTED)
    c.setFont("Helvetica-Oblique", 7)
    c.drawCentredString(PAGE_W / 2, HALF_H - 4, "— cortar aquí —")


def generar_recibo_individual_pdf(registro: RegistroResponse, periodo: PeriodoDetalle) -> bytes:
    buf = BytesIO()
    c = canvas.Canvas(buf, pagesize=letter)
    _dibujar_recibo(c, base_y=HALF_H, registro=registro, periodo=periodo)  # mitad superior
    _dibujar_linea_corte(c)
    c.showPage()
    c.save()
    return buf.getvalue()


def generar_recibos_periodo_pdf(periodo: PeriodoDetalle) -> bytes:
    buf = BytesIO()
    c = canvas.Canvas(buf, pagesize=letter)
    registros = periodo.registros
    if not registros:
        c.setFont("Helvetica", 12)
        c.drawCentredString(PAGE_W / 2, PAGE_H / 2, "Este período no tiene registros.")
        c.showPage()
        c.save()
        return buf.getvalue()

    for i in range(0, len(registros), 2):
        # Mitad superior
        _dibujar_recibo(c, base_y=HALF_H, registro=registros[i], periodo=periodo)
        # Mitad inferior si hay otro empleado
        if i + 1 < len(registros):
            _dibujar_recibo(c, base_y=0, registro=registros[i + 1], periodo=periodo)
        _dibujar_linea_corte(c)
        c.showPage()
    c.save()
    return buf.getvalue()
