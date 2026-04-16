import enum
from datetime import datetime
from sqlalchemy import Integer, Boolean, String, DateTime, Float, func, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from db.base import Base


class VerificacionPago(Base):
    __tablename__ = "verificaciones_pago"

    id_factura: Mapped[int] = mapped_column(Integer, primary_key=True)
    verificado: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    fecha_verificacion: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    notas: Mapped[str | None] = mapped_column(String(500), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=func.now(), onupdate=func.now())


class MetodoPago(str, enum.Enum):
    efectivo = "efectivo"
    transferencia = "transferencia"
    deposito_oxxo = "deposito_oxxo"
    no_especificado = "no_especificado"


class PagoRegistrado(Base):
    __tablename__ = "pagos_registrados"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    id_cliente: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    nombre_cliente: Mapped[str | None] = mapped_column(String(200), nullable=True)
    id_factura: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    monto: Mapped[float] = mapped_column(Float, nullable=False)
    fecha_pago: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=func.now())
    metodo_pago: Mapped[str] = mapped_column(String(50), nullable=False, default=MetodoPago.no_especificado)
    fecha_pago_real: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    comprobante_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    verificado: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    fecha_verificacion: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    notas: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())


class LogRecordatorio(Base):
    __tablename__ = "log_recordatorios"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    id_cliente: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    id_factura: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    dia_tolerancia: Mapped[int] = mapped_column(Integer, nullable=False)
    fecha_envio: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    exitoso: Mapped[bool] = mapped_column(Boolean, default=False)
    respuesta_api: Mapped[str | None] = mapped_column(String(500), nullable=True)

class EstadoEquipo(str, enum.Enum):
    recuperado = "recuperado"
    antena_recuperada = "antena_recuperada"
    modem_recuperado = "modem_recuperado"
    nada_recuperado = "nada_recuperado"

class Observacion(Base):
    __tablename__ = "observaciones"
    __table_args__ = (UniqueConstraint("entity_type", "entity_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    entity_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    entity_id: Mapped[int] = mapped_column(Integer, nullable=False)
    notas: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=func.now(), onupdate=func.now())


class RecoleccionRegistro(Base):
    __tablename__ = "recoleccion_registros"
    id_servicio: Mapped[int] = mapped_column(Integer, primary_key=True)
    estado_equipo: Mapped[str] = mapped_column(String(50), nullable=False)
    notas: Mapped[str | None] = mapped_column(String(500), nullable=True)
    id_tecnico: Mapped[int | None] = mapped_column(Integer, nullable=True)
    nombre_tecnico: Mapped[str | None] = mapped_column(String(200), nullable=True)
    fecha_registro: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=func.now(), onupdate=func.now())