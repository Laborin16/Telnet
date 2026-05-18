from datetime import datetime

from sqlalchemy import Integer, String, DateTime, Text
from sqlalchemy.orm import Mapped, mapped_column

from db.base import Base


class ClienteHistorial(Base):
    """Log canónico de eventos por cliente (id_servicio de WispHub).

    Cada acción relevante en la vida del servicio queda registrada aquí, sin
    importar de qué módulo provenga. Permite reconstruir la historia completa
    de un cliente sin tener que cruzar varias tablas en cada consulta.
    """
    __tablename__ = "cliente_historial"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    id_servicio: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    tipo_evento: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    fecha: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, nullable=False, index=True)
    usuario_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    usuario_nombre: Mapped[str] = mapped_column(String(200), nullable=False, default="Sistema")
    titulo: Mapped[str] = mapped_column(String(200), nullable=False)
    descripcion: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    datos_extra: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON serializado
    tarea_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    pago_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
