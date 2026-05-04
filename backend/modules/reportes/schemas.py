from datetime import datetime

from pydantic import BaseModel, ConfigDict, field_validator

from modules.reportes.enums import EstadoTarea, PrioridadTarea, TipoTarea


class TareaCreate(BaseModel):
    id_servicio: int
    tipo: TipoTarea
    prioridad: PrioridadTarea = PrioridadTarea.MEDIA
    descripcion: str
    tecnico_id: int | None = None
    latitud: float | None = None
    longitud: float | None = None

    @field_validator("descripcion")
    @classmethod
    def descripcion_no_vacia(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("La descripción no puede estar vacía")
        return v


class TareaUpdate(BaseModel):
    prioridad: PrioridadTarea | None = None
    descripcion: str | None = None
    latitud: float | None = None
    longitud: float | None = None

    @field_validator("descripcion")
    @classmethod
    def descripcion_no_vacia(cls, v: str | None) -> str | None:
        if v is not None:
            v = v.strip()
            if not v:
                raise ValueError("La descripción no puede estar vacía")
        return v


class AsignarTecnico(BaseModel):
    tecnico_id: int


class TransicionEstado(BaseModel):
    estado_nuevo: EstadoTarea
    comentario: str | None = None
    lat_evento: float | None = None
    lng_evento: float | None = None

    @field_validator("comentario")
    @classmethod
    def comentario_strip(cls, v: str | None) -> str | None:
        return v.strip() if v else None


class TareaResponse(BaseModel):
    id: int
    id_servicio: int
    tipo: TipoTarea
    prioridad: PrioridadTarea
    estado: EstadoTarea
    descripcion: str
    tecnico_id: int | None
    supervisor_id: int
    latitud: float | None
    longitud: float | None
    fecha_creada: datetime
    fecha_limite: datetime | None
    fecha_asignada: datetime | None
    fecha_iniciada: datetime | None
    fecha_completada: datetime | None
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TareaEventoResponse(BaseModel):
    id: int
    tarea_id: int
    usuario_id: int | None
    usuario_nombre: str
    timestamp: datetime
    estado_anterior: EstadoTarea | None
    estado_nuevo: EstadoTarea
    comentario: str | None
    lat_evento: float | None
    lng_evento: float | None

    model_config = ConfigDict(from_attributes=True)


class SuscripcionPushCreate(BaseModel):
    endpoint: str
    p256dh: str
    auth: str
    user_agent: str = ""


class EliminarSuscripcionPush(BaseModel):
    endpoint: str


class TareaFotoResponse(BaseModel):
    id: int
    tarea_id: int
    ruta: str
    nombre_original: str
    subido_por_nombre: str
    timestamp: datetime

    model_config = ConfigDict(from_attributes=True)
