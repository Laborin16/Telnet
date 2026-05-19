from datetime import date, datetime
from pydantic import BaseModel, ConfigDict, Field, field_validator

from modules.nomina.models import EstadoPeriodo, EstadoPrestamo, TipoIncidencia


# ─── Incidencias ────────────────────────────────────────────────────────────

class IncidenciaCreate(BaseModel):
    tipo: TipoIncidencia
    monto: float
    descripcion: str | None = None

    @field_validator("monto")
    @classmethod
    def monto_no_cero(cls, v: float) -> float:
        if v == 0:
            raise ValueError("El monto no puede ser cero")
        return round(v, 2)


class IncidenciaUpdate(BaseModel):
    tipo: TipoIncidencia | None = None
    monto: float | None = None
    descripcion: str | None = None


class IncidenciaResponse(BaseModel):
    id: int
    registro_id: int
    tipo: TipoIncidencia
    monto: float
    descripcion: str | None
    prestamo_id: int | None
    auto_generada: bool
    diferida: bool
    # Solo se llena para incidencias CUOTA_PRESTAMO: saldo pendiente del préstamo
    # DESPUÉS de aplicar esta cuota (al cierre del periodo).
    prestamo_saldo_restante: float | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DiferirCuotaRequest(BaseModel):
    diferida: bool


# ─── Registros ──────────────────────────────────────────────────────────────

class RegistroUpdate(BaseModel):
    """Actualización de asistencia, horas extra o notas."""
    dia_1: float | None = None
    dia_2: float | None = None
    dia_3: float | None = None
    dia_4: float | None = None
    dia_5: float | None = None
    dia_6: float | None = None
    dia_7: float | None = None
    horas_extra: float | None = None
    notas: str | None = None

    @field_validator("dia_1", "dia_2", "dia_3", "dia_4", "dia_5", "dia_6", "dia_7")
    @classmethod
    def asistencia_valida(cls, v: float | None) -> float | None:
        if v is None:
            return v
        if v not in (0.0, 0.5, 1.0):
            raise ValueError("La asistencia debe ser 0, 0.5 o 1")
        return v

    @field_validator("horas_extra")
    @classmethod
    def horas_no_negativas(cls, v: float | None) -> float | None:
        if v is None:
            return v
        if v < 0:
            raise ValueError("Las horas extra no pueden ser negativas")
        return round(v, 2)


class DiaBono(BaseModel):
    dia_idx: int           # 1=lunes, 7=domingo
    cuota: int             # cuota efectiva del día (varía por tipo, aquí el max evaluado)
    asignadas_total: int
    completadas_total: int
    cumplido: bool


class BonoPreview(BaseModel):
    aplica: bool                # solo true si rol=tecnico y monto_bono>0
    monto_bono: float
    dias_cumplidos: int
    dias_requeridos: int
    gana: bool
    detalle_dias: list[DiaBono]


class RegistroResponse(BaseModel):
    id: int
    periodo_id: int
    usuario_id: int
    usuario_nombre: str
    area: str | None

    dia_1: float
    dia_2: float
    dia_3: float
    dia_4: float
    dia_5: float
    dia_6: float
    dia_7: float

    dias_trabajados: float
    horas_extra: float
    sueldo_semanal_aplicado: float | None

    importe_base: float
    monto_horas_extra: float
    percepciones_extra: float
    deducciones: float
    total_a_pagar: float

    notas: str | None
    bono_override: str | None     # NULL | 'AGREGAR' | 'QUITAR'
    incidencias: list[IncidenciaResponse] = []
    bono: BonoPreview | None = None


class BonoOverrideRequest(BaseModel):
    override: str | None  # 'AGREGAR' | 'QUITAR' | None

    @field_validator("override")
    @classmethod
    def valido(cls, v: str | None) -> str | None:
        if v is None:
            return None
        if v not in ("AGREGAR", "QUITAR"):
            raise ValueError("override debe ser 'AGREGAR', 'QUITAR' o null")
        return v


# ─── Periodos ───────────────────────────────────────────────────────────────

class PeriodoCreate(BaseModel):
    """Crea un período manualmente. El cron lo hace automáticamente cada lunes."""
    fecha_inicio: date | None = None  # si no se especifica, usa el lunes de la semana actual


class PeriodoResumen(BaseModel):
    id: int
    fecha_inicio: date
    fecha_fin: date
    estado: EstadoPeriodo
    total_empleados: int
    total_a_pagar: float
    created_at: datetime
    closed_at: datetime | None

    model_config = ConfigDict(from_attributes=True)


class PeriodoDetalle(BaseModel):
    id: int
    fecha_inicio: date
    fecha_fin: date
    estado: EstadoPeriodo
    created_at: datetime
    closed_at: datetime | None
    closed_by_usuario_id: int | None
    registros: list[RegistroResponse]
    total_a_pagar: float


# ─── Préstamos ──────────────────────────────────────────────────────────────

class PrestamoCreate(BaseModel):
    usuario_id: int
    monto_total: float
    cuota_semanal: float
    cuotas_totales: int
    fecha_inicio: date | None = None
    motivo: str | None = None

    @field_validator("monto_total", "cuota_semanal")
    @classmethod
    def positivo(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("El monto debe ser mayor a cero")
        return round(v, 2)

    @field_validator("cuotas_totales")
    @classmethod
    def cuotas_positivas(cls, v: int) -> int:
        if v <= 0:
            raise ValueError("El número de cuotas debe ser mayor a cero")
        return v


class PrestamoUpdate(BaseModel):
    cuota_semanal: float | None = None
    cuotas_totales: int | None = None
    motivo: str | None = None
    estado: EstadoPrestamo | None = None


class PrestamoResponse(BaseModel):
    id: int
    usuario_id: int
    usuario_nombre: str
    monto_total: float
    cuota_semanal: float
    cuotas_totales: int
    cuotas_pagadas: int
    cuotas_restantes: int
    saldo_pendiente: float
    fecha_inicio: date
    estado: EstadoPrestamo
    motivo: str | None
    created_at: datetime


# ─── Dashboard ──────────────────────────────────────────────────────────────

class CostoPorArea(BaseModel):
    area: str
    empleados: int
    total: float


class DashboardNomina(BaseModel):
    periodo_actual_id: int | None
    costo_semanal: float
    empleados_en_nomina: int
    costo_por_area: list[CostoPorArea]
    prestamos_activos: int
    monto_prestamos_pendiente: float
