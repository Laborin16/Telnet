from datetime import datetime
from sqlalchemy import Integer, Boolean, String, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column
from db.base import Base


class VerificacionPago(Base):
    __tablename__ = "verificaciones_pago"

    id_factura: Mapped[int] = mapped_column(Integer, primary_key=True)
    verificado: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    fecha_verificacion: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    notas: Mapped[str | None] = mapped_column(String(500), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=func.now(), onupdate=func.now())
