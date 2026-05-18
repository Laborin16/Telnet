from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict


class HistorialEventoResponse(BaseModel):
    id: int
    id_servicio: int
    tipo_evento: str
    fecha: datetime
    usuario_id: int | None
    usuario_nombre: str
    titulo: str
    descripcion: str | None
    datos_extra: dict[str, Any] | None
    tarea_id: int | None
    pago_id: int | None

    model_config = ConfigDict(from_attributes=True)


class HistorialListResponse(BaseModel):
    total: int
    items: list[HistorialEventoResponse]
