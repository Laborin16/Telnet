import enum
from datetime import date, datetime
from sqlalchemy import (
    Integer, String, Boolean, DateTime, Date,
    Numeric, Text, ForeignKey, UniqueConstraint, Index, Enum,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from db.base import Base


class RecurrenciaPago(str, enum.Enum):
    NINGUNA   = "NINGUNA"
    SEMANAL   = "SEMANAL"
    QUINCENAL = "QUINCENAL"
    MENSUAL   = "MENSUAL"
    ANUAL     = "ANUAL"


class EstadoPagoEmpresa(str, enum.Enum):
    PENDIENTE = "PENDIENTE"
    PAGADO    = "PAGADO"


class CategoriaPagoEmpresa(Base):
    __tablename__ = "pagos_empresa_categorias"
    __table_args__ = (UniqueConstraint("nombre", name="uq_pagos_empresa_cat_nombre"),)

    id:          Mapped[int]              = mapped_column(Integer, primary_key=True, autoincrement=True)
    nombre:      Mapped[str]              = mapped_column(String(100), nullable=False)
    descripcion: Mapped[str | None]       = mapped_column(String(300), nullable=True)
    orden:       Mapped[int]              = mapped_column(Integer, nullable=False, default=0)
    activa:      Mapped[bool]             = mapped_column(Boolean, nullable=False, default=True)
    created_at:  Mapped[datetime]         = mapped_column(DateTime, nullable=False, default=datetime.now)
    updated_at:  Mapped[datetime]         = mapped_column(DateTime, nullable=False, default=datetime.now, onupdate=datetime.now)

    pagos: Mapped[list["PagoEmpresa"]] = relationship("PagoEmpresa", back_populates="categoria", lazy="select")


class PagoEmpresa(Base):
    __tablename__ = "pagos_empresa"
    __table_args__ = (
        Index("ix_pagos_empresa_estado_venc", "estado", "fecha_vencimiento"),
        Index("ix_pagos_empresa_cat_estado",  "categoria_id", "estado"),
    )

    id:                      Mapped[int]                  = mapped_column(Integer, primary_key=True, autoincrement=True)
    categoria_id:            Mapped[int]                  = mapped_column(Integer, ForeignKey("pagos_empresa_categorias.id"), nullable=False, index=True)
    concepto:                Mapped[str]                  = mapped_column(String(200), nullable=False)
    monto:                   Mapped[float]                = mapped_column(Numeric(12, 2), nullable=False)
    fecha_vencimiento:       Mapped[date]                 = mapped_column(Date, nullable=False, index=True)
    recurrencia:             Mapped[RecurrenciaPago]      = mapped_column(
        Enum(RecurrenciaPago, name="recurrencia_pago_empresa", values_callable=lambda x: [e.value for e in x]),
        nullable=False, default=RecurrenciaPago.NINGUNA,
    )
    estado:                  Mapped[EstadoPagoEmpresa]    = mapped_column(
        Enum(EstadoPagoEmpresa, name="estado_pago_empresa", values_callable=lambda x: [e.value for e in x]),
        nullable=False, default=EstadoPagoEmpresa.PENDIENTE,
    )
    proveedor:               Mapped[str | None]           = mapped_column(String(200), nullable=True)
    notas:                   Mapped[str | None]           = mapped_column(Text, nullable=True)
    comprobante_path:        Mapped[str | None]           = mapped_column(String(500), nullable=True)
    fecha_pago:              Mapped[datetime | None]      = mapped_column(DateTime, nullable=True)
    recordatorio_enviado_at: Mapped[datetime | None]      = mapped_column(DateTime, nullable=True)
    created_at:              Mapped[datetime]             = mapped_column(DateTime, nullable=False, default=datetime.now)
    updated_at:              Mapped[datetime]             = mapped_column(DateTime, nullable=False, default=datetime.now, onupdate=datetime.now)

    categoria: Mapped["CategoriaPagoEmpresa"] = relationship("CategoriaPagoEmpresa", back_populates="pagos")
