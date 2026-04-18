from datetime import datetime
from sqlalchemy import Integer, String, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from db.base import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    usuario_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    usuario_nombre: Mapped[str] = mapped_column(String(200), nullable=False, default="Sin identificar")
    accion: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    # CREAR | ACTUALIZAR | ELIMINAR | EJECUTAR | SUSPENDER | ACTIVAR | VERIFICAR
    modulo: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    entidad: Mapped[str] = mapped_column(String(100), nullable=False)
    entidad_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    descripcion: Mapped[str] = mapped_column(String(1000), nullable=False)
    datos_extra: Mapped[str | None] = mapped_column(String(2000), nullable=True)  # JSON serializado
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, index=True)
