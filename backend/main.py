from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text
from core.config import settings
from core.wisphub.client import wisphub_client
from modules.clients.router import router as clients_router
from modules.whatsapp.router import router as whatsapp_router
from modules.finanzas.router import router as finanzas_router
from modules.auditlog.router import router as audit_router
from modules.auth.router import router as auth_router
from db.session import engine
from db.base import Base
import modules.finanzas.models   # noqa: F401
import modules.auditlog.models   # noqa: F401
import modules.auth.models       # noqa: F401 — registers Usuario with Base


async def _run_migrations(conn):
    await conn.run_sync(Base.metadata.create_all)
    # Agrega columnas nuevas a tablas existentes si no existen
    for sql in [
        "ALTER TABLE pagos_registrados ADD COLUMN nombre_cliente VARCHAR(200)",
        "ALTER TABLE pagos_registrados ADD COLUMN fecha_pago_real DATETIME",
        "ALTER TABLE pagos_registrados ADD COLUMN comprobante_path VARCHAR(500)",
        "ALTER TABLE recoleccion_registros ADD COLUMN id_tecnico INTEGER",
        "ALTER TABLE recoleccion_registros ADD COLUMN nombre_tecnico VARCHAR(200)",
    ]:
        try:
            await conn.execute(text(sql))
        except Exception:
            pass  # columna ya existe


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await _run_migrations(conn)
    yield
    await wisphub_client.close()


app = FastAPI(
    title="WISP Manager API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.allowed_origins.split(",") if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*", "X-Usuario-Id", "X-Usuario-Nombre"],
)

app.mount("/static/comprobantes", StaticFiles(directory="data/comprobantes"), name="comprobantes")
app.include_router(clients_router, prefix="/api/v1/clients", tags=["clients"])
app.include_router(whatsapp_router, prefix="/api/v1/whatsapp", tags=["whatsapp"])
app.include_router(finanzas_router, prefix="/api/v1/finanzas", tags=["finanzas"])
app.include_router(audit_router, prefix="/api/v1/audit", tags=["audit"])
app.include_router(auth_router,  prefix="/api/v1/auth",  tags=["auth"])


@app.get("/api/v1/health")
async def health():
    return {"status": "ok"}