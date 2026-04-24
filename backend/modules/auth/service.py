from datetime import datetime, timedelta, timezone
from typing import Optional
import secrets
import jwt
import bcrypt as _bcrypt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings
from core.wisphub.client import wisphub_client
from modules.auth.models import Usuario


def generate_temp_password() -> str:
    """Genera una contraseña temporal segura de 12 caracteres."""
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
        "wisphub_id": user.wisphub_id,
        "es_admin": user.es_admin,
        "debe_cambiar_password": user.debe_cambiar_password,
        "exp": exp,
    }
    return jwt.encode(payload, settings.app_secret_key, algorithm=_ALGORITHM)


def decode_token(token: str) -> dict:
    """Lanza jwt.InvalidTokenError si el token es inválido o expirado."""
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
        raise ValueError("Este usuario aún no tiene contraseña configurada. Pide al administrador que sincronice los usuarios.")
    if not verify_password(password, user.password_hash):
        raise ValueError("Contraseña incorrecta.")

    token = create_token(user)
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "wisphub_id": user.wisphub_id,
            "username": user.username,
            "nombre": user.nombre,
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


async def sync_usuarios_from_wisphub(db: AsyncSession) -> dict:
    """
    Sincroniza usuarios del staff de WispHub a la tabla local.
    Si el usuario no existe → lo crea con contraseña inicial = su username.
    Si ya existe → actualiza nombre pero NO toca la contraseña.
    """
    data = await wisphub_client.get("/api/staff/", params={"page_size": 100})
    staff = data.get("results", [])

    creados = 0
    actualizados = 0
    passwords_temporales: list[dict] = []

    for s in staff:
        wisphub_id = s.get("id")
        username = (s.get("username") or str(wisphub_id) or "").strip().lower()
        nombre = (s.get("nombre") or s.get("username") or "").strip()
        if not username:
            continue

        result = await db.execute(
            select(Usuario).where(Usuario.wisphub_id == wisphub_id)
        )
        existing = result.scalar_one_or_none()

        if existing is None:
            temp_pw = generate_temp_password()
            db.add(Usuario(
                wisphub_id=wisphub_id,
                username=username,
                nombre=nombre or username,
                password_hash=hash_password(temp_pw),
                activo=True,
                debe_cambiar_password=True,
            ))
            passwords_temporales.append({"username": username, "nombre": nombre, "password_temporal": temp_pw})
            creados += 1
        else:
            existing.nombre = nombre or existing.nombre
            existing.updated_at = datetime.now()
            actualizados += 1

    await db.commit()
    return {
        "creados": creados,
        "actualizados": actualizados,
        "total": len(staff),
        "passwords_temporales": passwords_temporales,
    }


async def get_usuarios(db: AsyncSession) -> list:
    result = await db.execute(select(Usuario).order_by(Usuario.nombre))
    return [
        {
            "id": u.id,
            "wisphub_id": u.wisphub_id,
            "username": u.username,
            "nombre": u.nombre,
            "activo": u.activo,
            "es_admin": u.es_admin,
            "debe_cambiar_password": u.debe_cambiar_password,
        }
        for u in result.scalars().all()
    ]


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
