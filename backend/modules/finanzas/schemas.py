from datetime import datetime
from pydantic import BaseModel, ConfigDict, field_validator


class PagoCreate(BaseModel):
    id_cliente: str
    id_factura: int | None = None
    monto: float
    metodo_pago: str = "no_especificado"
    notas: str | None = None

    @field_validator("monto")
    @classmethod
    def monto_positivo(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("El monto debe ser mayor a cero")
        return round(v, 2)


class PagoResponse(BaseModel):
    id: int
    id_cliente: str
    id_factura: int | None
    monto: float
    fecha_pago: datetime
    metodo_pago: str
    verificado: bool
    fecha_verificacion: datetime | None
    notas: str | None

    model_config = ConfigDict(from_attributes=True)


class ResultadoCobranza(BaseModel):
    recordatorios_enviados: int
    cortes_ejecutados: int
    errores: int
