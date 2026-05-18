import enum
from datetime import datetime
from sqlalchemy import Integer, String, Boolean, DateTime, Enum
from sqlalchemy.orm import Mapped, mapped_column
from db.base import Base


class RolUsuario(str, enum.Enum):
    ADMINISTRADOR = "administrador"
    SUPERVISOR    = "supervisor"
    TECNICO       = "tecnico"
    COBRANZA      = "cobranza"
    VENTAS        = "ventas"


class Usuario(Base):
    __tablename__ = "usuarios"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    wisphub_id: Mapped[int | None] = mapped_column(Integer, nullable=True, unique=True, index=True)
    username: Mapped[str] = mapped_column(String(100), nullable=False, unique=True, index=True)
    nombre: Mapped[str] = mapped_column(String(200), nullable=False)
    password_hash: Mapped[str | None] = mapped_column(String(200), nullable=True)
    activo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    rol: Mapped[RolUsuario] = mapped_column(
        Enum(RolUsuario, name="rolusuario", create_constraint=True, values_callable=lambda x: [e.value for e in x]),
        default=RolUsuario.TECNICO,
        nullable=False,
    )
    debe_cambiar_password: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, onupdate=datetime.now)

    # Propiedad de conveniencia para el código existente
    @property
    def es_admin(self) -> bool:
        return self.rol == RolUsuario.ADMINISTRADOR
