from datetime import datetime, timedelta, timezone
from typing import Optional
import secrets
import jwt
import bcrypt as _bcrypt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings
from modules.auth.models import Usuario, RolUsuario


def generate_temp_password() -> str:
    alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789"
    return "".join(secrets.choice(alphabet) for _ in range(12))

_ALGORITHM = "HS256"
_TOKEN_EXPIRE_HOURS = 8


# ── Contraseñas ──────────────────────────────────────────────────────────────

def hash_password(plain: str) -> str:
    secret = plain.encode("utf-8")[:72]
    return _bcrypt.hashpw(secret, _bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    secret = plain.encode("utf-8")[:72]
    return _bcrypt.checkpw(secret, hashed.encode("utf-8"))


# ── JWT ──────────────────────────────────────────────────────────────────────

def create_token(user: Usuario) -> str:
    exp = datetime.now(timezone.utc) + timedelta(hours=_TOKEN_EXPIRE_HOURS)
    payload = {
        "sub": str(user.id),
        "nombre": user.nombre,
        "username": user.username,
        "rol": user.rol.value,
        "es_admin": user.rol == RolUsuario.ADMINISTRADOR,  # compat con código existente
        "debe_cambiar_password": user.debe_cambiar_password,
        "exp": exp,
    }
    return jwt.encode(payload, settings.app_secret_key, algorithm=_ALGORITHM)


def decode_token(token: str) -> dict:
    return jwt.decode(token, settings.app_secret_key, algorithms=[_ALGORITHM])


# ── Autenticación ────────────────────────────────────────────────────────────

async def login(username: str, password: str, db: AsyncSession) -> dict:
    result = await db.execute(
        select(Usuario).where(Usuario.username == username, Usuario.activo == True)  # noqa: E712
    )
    user = result.scalar_one_or_none()

    if not user:
        raise ValueError("Usuario no encontrado o inactivo.")
    if not user.password_hash:
        raise ValueError("Este usuario no tiene contraseña configurada.")
    if not verify_password(password, user.password_hash):
        raise ValueError("Contraseña incorrecta.")

    token = create_token(user)
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "username": user.username,
            "nombre": user.nombre,
            "rol": user.rol.value,
            "es_admin": user.es_admin,
            "debe_cambiar_password": user.debe_cambiar_password,
        },
    }


# ── Gestión de usuarios ──────────────────────────────────────────────────────

async def cambiar_password(user_id: int, password_actual: str, password_nuevo: str, db: AsyncSession) -> str:
    result = await db.execute(select(Usuario).where(Usuario.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise ValueError("Usuario no encontrado.")
    if not user.password_hash or not verify_password(password_actual, user.password_hash):
        raise ValueError("La contraseña actual es incorrecta.")
    if len(password_nuevo) < 6:
        raise ValueError("La contraseña debe tener al menos 6 caracteres.")
    user.password_hash = hash_password(password_nuevo)
    user.debe_cambiar_password = False
    user.updated_at = datetime.now()
    await db.commit()
    return create_token(user)


async def crear_usuario(
    username: str, nombre: str, rol: str, db: AsyncSession,
    sueldo_semanal: float | None = None, area: str | None = None, en_nomina: bool = False,
    monto_bono: float | None = None,
) -> dict:
    username = username.strip().lower()
    nombre = nombre.strip()
    if not username or not nombre:
        raise ValueError("El nombre y el usuario son obligatorios.")
    try:
        rol_enum = RolUsuario(rol)
    except ValueError:
        raise ValueError(f"Rol inválido: {rol}. Opciones: administrador, supervisor, tecnico, cobranza.")

    existing = await db.execute(select(Usuario).where(Usuario.username == username))
    if existing.scalar_one_or_none():
        raise ValueError(f"El usuario '{username}' ya está registrado.")

    temp_pw = generate_temp_password()
    user = Usuario(
        username=username,
        nombre=nombre,
        password_hash=hash_password(temp_pw),
        rol=rol_enum,
        activo=True,
        debe_cambiar_password=True,
        sueldo_semanal=sueldo_semanal,
        area=(area.strip() if area else None) or None,
        en_nomina=bool(en_nomina),
        monto_bono=monto_bono if (monto_bono is not None and monto_bono > 0) else None,
    )
    db.add(user)
    await db.commit()
    return {"username": user.username, "nombre": user.nombre, "password_temporal": temp_pw}


async def actualizar_usuario(
    user_id: int, activo: bool | None, rol: str | None, nombre: str | None, db: AsyncSession,
    sueldo_semanal: float | None = None, area: str | None = None, en_nomina: bool | None = None,
    monto_bono: float | None = None,
) -> dict:
    result = await db.execute(select(Usuario).where(Usuario.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise ValueError("Usuario no encontrado.")
    if activo is not None:
        user.activo = activo
    if rol is not None:
        try:
            user.rol = RolUsuario(rol)
        except ValueError:
            raise ValueError(f"Rol inválido: {rol}.")
    if nombre is not None:
        nombre = nombre.strip()
        if nombre:
            user.nombre = nombre
    if sueldo_semanal is not None:
        user.sueldo_semanal = sueldo_semanal if sueldo_semanal > 0 else None
    if area is not None:
        user.area = area.strip() or None
    if en_nomina is not None:
        user.en_nomina = bool(en_nomina)
    if monto_bono is not None:
        user.monto_bono = monto_bono if monto_bono > 0 else None
    user.updated_at = datetime.now()
    await db.commit()
    return _usuario_dict(user)


async def get_usuarios(db: AsyncSession) -> list:
    result = await db.execute(select(Usuario).order_by(Usuario.nombre))
    return [_usuario_dict(u) for u in result.scalars().all()]


async def reset_password(user_id: int, db: AsyncSession) -> dict:
    result = await db.execute(select(Usuario).where(Usuario.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise ValueError("Usuario no encontrado.")
    temp_pw = generate_temp_password()
    user.password_hash = hash_password(temp_pw)
    user.debe_cambiar_password = True
    user.updated_at = datetime.now()
    await db.commit()
    return {"username": user.username, "nombre": user.nombre, "password_temporal": temp_pw}


async def eliminar_usuario(user_id: int, solicitante_id: int, db: AsyncSession) -> None:
    result = await db.execute(select(Usuario).where(Usuario.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise ValueError("Usuario no encontrado.")
    if user.id == solicitante_id:
        raise ValueError("No puedes eliminar tu propia cuenta.")
    await db.delete(user)
    await db.commit()


def _usuario_dict(u: Usuario) -> dict:
    return {
        "id": u.id,
        "username": u.username,
        "nombre": u.nombre,
        "activo": u.activo,
        "rol": u.rol.value,
        "es_admin": u.es_admin,
        "debe_cambiar_password": u.debe_cambiar_password,
        "sueldo_semanal": u.sueldo_semanal,
        "area": u.area,
        "en_nomina": u.en_nomina,
        "monto_bono": u.monto_bono,
    }
