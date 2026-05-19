from datetime import date, datetime
from pydantic import BaseModel, ConfigDict, Field, field_validator

from modules.pagos_empresa.models import RecurrenciaPago, EstadoPagoEmpresa


# ─── Categorías ─────────────────────────────────────────────────────────────

class CategoriaCreate(BaseModel):
    nombre: str = Field(..., min_length=1, max_length=100)
    descripcion: str | None = None
    orden: int = 0

    @field_validator("nombre")
    @classmethod
    def nombre_no_vacio(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("El nombre no puede estar vacío.")
        return v


class CategoriaUpdate(BaseModel):
    nombre: str | None = Field(None, min_length=1, max_length=100)
    descripcion: str | None = None
    orden: int | None = None
    activa: bool | None = None

    @field_validator("nombre")
    @classmethod
    def nombre_no_vacio(cls, v: str | None) -> str | None:
        if v is None:
            return v
        v = v.strip()
        if not v:
            raise ValueError("El nombre no puede estar vacío.")
        return v


class CategoriaResponse(BaseModel):
    id: int
    nombre: str
    descripcion: str | None
    orden: int
    activa: bool
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


# ─── Pagos ──────────────────────────────────────────────────────────────────

class PagoCreate(BaseModel):
    categoria_id: int
    concepto: str = Field(..., min_length=1, max_length=200)
    monto: float = Field(..., gt=0)
    fecha_vencimiento: date
    recurrencia: RecurrenciaPago = RecurrenciaPago.NINGUNA
    proveedor: str | None = None
    notas: str | None = None


class PagoUpdate(BaseModel):
    concepto: str | None = Field(None, min_length=1, max_length=200)
    monto: float | None = Field(None, gt=0)
    fecha_vencimiento: date | None = None
    recurrencia: RecurrenciaPago | None = None
    proveedor: str | None = None
    notas: str | None = None
    categoria_id: int | None = None


class PagoResponse(BaseModel):
    id: int
    categoria_id: int
    categoria_nombre: str
    concepto: str
    monto: float
    fecha_vencimiento: date
    recurrencia: RecurrenciaPago
    estado: EstadoPagoEmpresa
    proveedor: str | None
    notas: str | None
    comprobante_url: str | None
    fecha_pago: datetime | None
    recordatorio_enviado_at: datetime | None
    created_at: datetime


class MarcarPagadoPayload(BaseModel):
    notas: str | None = None
