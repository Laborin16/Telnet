from fastapi import APIRouter, Depends
from core.dependencies import get_wisphub_client
from modules.clients.service import ClientService

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
):
    service = ClientService(client)
    return await service.suspend_client(client_id)


@router.post("/{client_id}/activate")
async def activate_client(
    client_id: int,
    client: object = Depends(get_wisphub_client),
):
    service = ClientService(client)
    return await service.activate_client(client_id)