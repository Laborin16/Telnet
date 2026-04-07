from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from core.wisphub.client import wisphub_client
from modules.clients.router import router as clients_router
from modules.whatsapp.router import router as whatsapp_router
from modules.finanzas.router import router as finanzas_router
from db.session import engine
from db.base import Base
import modules.finanzas.models  # noqa: F401 — registers VerificacionPago with Base


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    await wisphub_client.close()


app = FastAPI(
    title="WISP Manager API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(clients_router, prefix="/api/v1/clients", tags=["clients"])
app.include_router(whatsapp_router, prefix="/api/v1/whatsapp", tags=["whatsapp"])
app.include_router(finanzas_router, prefix="/api/v1/finanzas", tags=["finanzas"])


@app.get("/api/v1/health")
async def health():
    return {"status": "ok"}