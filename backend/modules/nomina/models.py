import enum
from datetime import date, datetime
from sqlalchemy import Integer, String, Boolean, DateTime, Date, Float, Enum, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from db.base import Base


class EstadoPeriodo(str, enum.Enum):
    BORRADOR = "BORRADOR"
    CERRADA  = "CERRADA"


class TipoIncidencia(str, enum.Enum):
    PERCEPCION_EXTRA    = "PERCEPCION_EXTRA"
    HORA_EXTRA          = "HORA_EXTRA"
    BONO_PRODUCTIVIDAD  = "BONO_PRODUCTIVIDAD"
    ADELANTO            = "ADELANTO"
    CUOTA_PRESTAMO      = "CUOTA_PRESTAMO"
    DESCUENTO_FALTA     = "DESCUENTO_FALTA"
    DESCUENTO_RETARDO   = "DESCUENTO_RETARDO"
    DESCUENTO_BIEN      = "DESCUENTO_BIEN"
    OTRO                = "OTRO"


class EstadoPrestamo(str, enum.Enum):
    ACTIVO    = "ACTIVO"
    PAGADO    = "PAGADO"
    CANCELADO = "CANCELADO"


class NominaPeriodo(Base):
    __tablename__ = "nomina_periodos"
    __table_args__ = (UniqueConstraint("fecha_inicio", name="uq_nomina_periodo_inicio"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    fecha_inicio: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    fecha_fin: Mapped[date] = mapped_column(Date, nullable=False)
    estado: Mapped[EstadoPeriodo] = mapped_column(
        Enum(EstadoPeriodo, name="estado_periodo_nomina", values_callable=lambda x: [e.value for e in x]),
        default=EstadoPeriodo.BORRADOR,
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, nullable=False)
    closed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    closed_by_usuario_id: Mapped[int | None] = mapped_column(Integer, nullable=True)


class NominaRegistro(Base):
    __tablename__ = "nomina_registros"
    __table_args__ = (UniqueConstraint("periodo_id", "usuario_id", name="uq_nomina_periodo_usuario"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    periodo_id: Mapped[int] = mapped_column(Integer, ForeignKey("nomina_periodos.id", ondelete="CASCADE"), nullable=False, index=True)
    usuario_id: Mapped[int] = mapped_column(Integer, ForeignKey("usuarios.id"), nullable=False, index=True)

    # Asistencia diaria — 0, 0.5 o 1
    dia_1: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)  # lunes
    dia_2: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    dia_3: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    dia_4: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    dia_5: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    dia_6: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    dia_7: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)  # domingo

    horas_extra: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)

    # Snapshot del sueldo semanal al cierre (queda congelado aunque el sueldo del usuario cambie después)
    sueldo_semanal_aplicado: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Override manual del bono de productividad:
    # NULL = auto (algoritmo decide), 'AGREGAR' = forzar bono, 'QUITAR' = forzar sin bono
    bono_override: Mapped[str | None] = mapped_column(String(20), nullable=True)

    notas: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, onupdate=datetime.now, nullable=False)


class NominaIncidencia(Base):
    __tablename__ = "nomina_incidencias"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    registro_id: Mapped[int] = mapped_column(Integer, ForeignKey("nomina_registros.id", ondelete="CASCADE"), nullable=False, index=True)
    tipo: Mapped[TipoIncidencia] = mapped_column(
        Enum(TipoIncidencia, name="tipo_incidencia_nomina", values_callable=lambda x: [e.value for e in x]),
        nullable=False,
    )
    # Monto firmado: positivo = percepción, negativo = deducción
    monto: Mapped[float] = mapped_column(Float, nullable=False)
    descripcion: Mapped[str | None] = mapped_column(String(300), nullable=True)
    prestamo_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("nomina_prestamos.id", ondelete="SET NULL"), nullable=True, index=True)
    auto_generada: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    # Cuando True, la incidencia no entra al cálculo del total (cuota diferida)
    diferida: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, nullable=False)


class NominaPrestamo(Base):
    __tablename__ = "nomina_prestamos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    usuario_id: Mapped[int] = mapped_column(Integer, ForeignKey("usuarios.id"), nullable=False, index=True)
    monto_total: Mapped[float] = mapped_column(Float, nullable=False)
    cuota_semanal: Mapped[float] = mapped_column(Float, nullable=False)
    cuotas_totales: Mapped[int] = mapped_column(Integer, nullable=False)
    cuotas_pagadas: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    fecha_inicio: Mapped[date] = mapped_column(Date, default=date.today, nullable=False)
    estado: Mapped[EstadoPrestamo] = mapped_column(
        Enum(EstadoPrestamo, name="estado_prestamo_nomina", values_callable=lambda x: [e.value for e in x]),
        default=EstadoPrestamo.ACTIVO,
        nullable=False,
        index=True,
    )
    motivo: Mapped[str | None] = mapped_column(String(300), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, onupdate=datetime.now, nullable=False)
