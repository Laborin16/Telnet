from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from db.session import get_db
from modules.auth.service import (
    login, cambiar_password, crear_usuario, actualizar_usuario,
    get_usuarios, reset_password, decode_token,
)
import jwt

router = APIRouter()


class LoginRequest(BaseModel):
    username: str
    password: str


class CambiarPasswordRequest(BaseModel):
    password_actual: str
    password_nuevo: str


class CrearUsuarioRequest(BaseModel):
    username: str
    nombre: str
    es_admin: bool = False


class ActualizarUsuarioRequest(BaseModel):
    activo: bool | None = None
    es_admin: bool | None = None
    nombre: str | None = None


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/login")
async def auth_login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    try:
        return await login(body.username.strip().lower(), body.password, db)
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))


@router.get("/me")
async def auth_me(authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="No autenticado.")
    try:
        payload = decode_token(authorization[7:])
        return {
            "id": int(payload["sub"]),
            "wisphub_id": payload.get("wisphub_id"),
            "username": payload.get("username"),
            "nombre": payload.get("nombre"),
            "es_admin": payload.get("es_admin", False),
        }
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Sesión expirada. Inicia sesión nuevamente.")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token inválido.")


@router.post("/cambiar-password")
async def auth_cambiar_password(
    body: CambiarPasswordRequest,
    db: AsyncSession = Depends(get_db),
    authorization: Optional[str] = Header(None),
):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="No autenticado.")
    try:
        payload = decode_token(authorization[7:])
        user_id = int(payload["sub"])
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token inválido.")

    try:
        new_token = await cambiar_password(user_id, body.password_actual, body.password_nuevo, db)
        return {"ok": True, "mensaje": "Contraseña actualizada correctamente.", "access_token": new_token}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/usuarios")
async def auth_usuarios(db: AsyncSession = Depends(get_db)):
    return await get_usuarios(db)


@router.post("/usuarios", status_code=201)
async def auth_crear_usuario(
    body: CrearUsuarioRequest,
    db: AsyncSession = Depends(get_db),
    authorization: Optional[str] = Header(None),
):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="No autenticado.")
    try:
        payload = decode_token(authorization[7:])
        if not payload.get("es_admin"):
            raise HTTPException(status_code=403, detail="Solo los administradores pueden crear usuarios.")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token inválido.")
    try:
        return await crear_usuario(body.username, body.nombre, body.es_admin, db)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.patch("/usuarios/{user_id}")
async def auth_actualizar_usuario(
    user_id: int,
    body: ActualizarUsuarioRequest,
    db: AsyncSession = Depends(get_db),
    authorization: Optional[str] = Header(None),
):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="No autenticado.")
    try:
        payload = decode_token(authorization[7:])
        if not payload.get("es_admin"):
            raise HTTPException(status_code=403, detail="Solo los administradores pueden modificar usuarios.")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token inválido.")
    try:
        return await actualizar_usuario(user_id, body.activo, body.es_admin, body.nombre, db)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/reset-password/{user_id}")
async def auth_reset_password(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    authorization: Optional[str] = Header(None),
):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="No autenticado.")
    try:
        payload = decode_token(authorization[7:])
        if not payload.get("es_admin"):
            raise HTTPException(status_code=403, detail="Solo los administradores pueden resetear contraseñas.")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token inválido.")
    try:
        return await reset_password(user_id, db)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
