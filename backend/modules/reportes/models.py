from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from db.base import Base
from modules.reportes.enums import EstadoTarea, PrioridadTarea


class Tarea(Base):
    __tablename__ = "tareas"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    id_servicio: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    tipo: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    prioridad: Mapped[str] = mapped_column(String(20), nullable=False, default=PrioridadTarea.MEDIA)
    estado: Mapped[str] = mapped_column(String(20), nullable=False, default=EstadoTarea.PENDIENTE, index=True)
    descripcion: Mapped[str] = mapped_column(String(1000), nullable=False)
    tecnico_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("usuarios.id", ondelete="SET NULL"), nullable=True, index=True
    )
    supervisor_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("usuarios.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    latitud: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitud: Mapped[float | None] = mapped_column(Float, nullable=True)
    fecha_creada: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.now)
    fecha_asignada: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    fecha_iniciada: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    fecha_completada: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, onupdate=datetime.now)


class TareaEvento(Base):
    __tablename__ = "tarea_eventos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tarea_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("tareas.id", ondelete="CASCADE"), nullable=False, index=True
    )
    usuario_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("usuarios.id", ondelete="SET NULL"), nullable=True
    )
    usuario_nombre: Mapped[str] = mapped_column(String(200), nullable=False, default="Sin identificar")
    timestamp: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.now, index=True)
    estado_anterior: Mapped[str | None] = mapped_column(String(20), nullable=True)
    estado_nuevo: Mapped[str] = mapped_column(String(20), nullable=False)
    comentario: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    lat_evento: Mapped[float | None] = mapped_column(Float, nullable=True)
    lng_evento: Mapped[float | None] = mapped_column(Float, nullable=True)
