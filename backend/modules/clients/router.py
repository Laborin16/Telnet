from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from db.session import get_db
from core.dependencies import get_wisphub_client, get_usuario
from modules.clients.service import ClientService
from modules.auditlog.service import log_accion

router = APIRouter()


@router.get("/")
async def list_clients(
    page: int = 1,
    page_size: int = 25,
    status: str = None,
    search: str = None,
    client: object = Depends(get_wisphub_client),
):
    service = ClientService(client)
    return await service.list_clients(page=page, page_size=page_size, status=status, search=search)


@router.get("/{client_id}")
async def get_client(
    client_id: int,
    client: object = Depends(get_wisphub_client),
):
    service = ClientService(client)
    return await service.get_client(client_id)


@router.post("/{client_id}/suspend")
async def suspend_client(
    client_id: int,
    client: object = Depends(get_wisphub_client),
    db: AsyncSession = Depends(get_db),
    usuario: dict = Depends(get_usuario),
):
    service = ClientService(client)
    result = await service.suspend_client(client_id)
    await log_accion(
        db, usuario,
        accion="SUSPENDER",
        modulo="clientes",
        entidad="servicio",
        entidad_id=str(client_id),
        descripcion=f"Servicio suspendido — id_servicio #{client_id}",
        datos_extra={"id_servicio": client_id},
    )
    return result


@router.post("/{client_id}/activate")
async def activate_client(
    client_id: int,
    client: object = Depends(get_wisphub_client),
    db: AsyncSession = Depends(get_db),
    usuario: dict = Depends(get_usuario),
):
    service = ClientService(client)
    result = await service.activate_client(client_id)
    await log_accion(
        db, usuario,
        accion="ACTIVAR",
        modulo="clientes",
        entidad="servicio",
        entidad_id=str(client_id),
        descripcion=f"Servicio activado — id_servicio #{client_id}",
        datos_extra={"id_servicio": client_id},
    )
    return result
