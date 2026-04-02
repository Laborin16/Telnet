from fastapi import APIRouter, Depends
from core.dependencies import get_wisphub_client
from modules.clients.service import ClientService

router = APIRouter()


@router.get("/")
async def list_clients(
    page: int = 1,
    status: str = None,
    search: str = None,
    client: object = Depends(get_wisphub_client),
):
    service = ClientService(client)
    return await service.list_clients(page=page, status=status, search=search)


@router.get("/{client_id}")
async def get_client(
    client_id: int,
    client: object = Depends(get_wisphub_client),
):
    service = ClientService(client)
    return await service.get_client(client_id)