from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from core.wisphub.client import wisphub_client
from modules.clients.router import router as clients_router


@asynccontextmanager
async def lifespan(app: FastAPI):
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


@app.get("/api/v1/health")
async def health():
    return {"status": "ok"}