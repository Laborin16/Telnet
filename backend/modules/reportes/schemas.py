import re
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, field_validator, model_validator

from modules.reportes.enums import EstadoTarea, PrioridadTarea, TipoTarea


# Formato requerido por WispHub: 8-14 dígitos sin código de país. Múltiples
# números se separan por coma.
_TELEFONO_RE = re.compile(r"^\d{8,14}(,\d{8,14})*$")


def _validar_telefono(v: str | None) -> str | None:
    if v is None:
        return v
    limpio = re.sub(r"[\s\-()]", "", v)
    if not limpio:
        return None
    if not _TELEFONO_RE.match(limpio):
        raise ValueError(
            "Formato inválido. Usa 8-14 dígitos sin código de país (ej. 6441234567). "
            "Para varios números, sepáralos por coma."
        )
    return limpio


class InstalacionDatos(BaseModel):
    """Datos del nuevo cliente para tareas de tipo INSTALACION (al crear)."""
    nombre_cliente: str
    telefono: str | None = None
    telefono2: str | None = None
    direccion: str | None = None

    @field_validator("nombre_cliente")
    @classmethod
    def no_vacio(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Este campo no puede estar vacío")
        return v

    @field_validator("telefono", "telefono2")
    @classmethod
    def validar_tel(cls, v: str | None) -> str | None:
        return _validar_telefono(v)


class InstalacionDatosUpdate(BaseModel):
    """Edición de los datos del cliente de una INSTALACION (antes de completar)."""
    nombre_cliente: str | None = None
    telefono: str | None = None
    telefono2: str | None = None
    direccion: str | None = None

    @field_validator("nombre_cliente")
    @classmethod
    def nombre_no_vacio(cls, v: str | None) -> str | None:
        if v is not None:
            v = v.strip()
            if not v:
                raise ValueError("El nombre no puede estar vacío")
        return v

    @field_validator("telefono", "telefono2")
    @classmethod
    def validar_tel(cls, v: str | None) -> str | None:
        return _validar_telefono(v)


class CompletarInstalacionDatos(BaseModel):
    """Datos técnicos requeridos al marcar COMPLETADO una tarea INSTALACION.

    Se valida que la IP exista en `obtener_ips_disponibles(router_id)` y se
    crea el cliente en WispHub al completar (no antes).
    """
    router_id: int
    router_nombre: str | None = None
    zona_id: int | None = None
    zona_nombre: str | None = None
    plan_id: int
    plan_nombre: str | None = None
    ip_asignada: str

    @field_validator("ip_asignada")
    @classmethod
    def ip_no_vacia(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("La IP no puede estar vacía")
        return v


class TareaCreate(BaseModel):
    id_servicio: int | None = None        # Requerido para todos excepto INSTALACION
    tipo: TipoTarea
    prioridad: PrioridadTarea = PrioridadTarea.MEDIA
    descripcion: str
    tecnico_id: int | None = None
    latitud: float | None = None
    longitud: float | None = None
    fecha_inicio: datetime | None = None
    fecha_fin: datetime | None = None
    instalacion: InstalacionDatos | None = None   # Solo para INSTALACION

    @field_validator("descripcion")
    @classmethod
    def descripcion_no_vacia(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("La descripción no puede estar vacía")
        return v

    @model_validator(mode="after")
    def check_servicio_o_instalacion(self) -> "TareaCreate":
        if self.tipo == TipoTarea.INSTALACION:
            if not self.instalacion:
                raise ValueError("Las tareas de instalación requieren el campo 'instalacion'")
        elif self.tipo != TipoTarea.TRABAJO_GENERAL:
            if not self.id_servicio:
                raise ValueError("id_servicio es requerido para este tipo de tarea")
        return self


class TareaUpdate(BaseModel):
    prioridad: PrioridadTarea | None = None
    descripcion: str | None = None
    latitud: float | None = None
    longitud: float | None = None
    fecha_inicio: datetime | None = None
    fecha_fin: datetime | None = None

    @field_validator("descripcion")
    @classmethod
    def descripcion_no_vacia(cls, v: str | None) -> str | None:
        if v is not None:
            v = v.strip()
            if not v:
                raise ValueError("La descripción no puede estar vacía")
        return v


class VincularServicio(BaseModel):
    """Permite ligar el id_servicio de WispHub a una instalación ya creada."""
    id_servicio: int


class AsignarTecnico(BaseModel):
    tecnico_id: int


class TransicionEstado(BaseModel):
    estado_nuevo: EstadoTarea
    comentario: str | None = None
    lat_evento: float | None = None
    lng_evento: float | None = None
    # Solo requerido al completar una tarea INSTALACION
    completar_instalacion: CompletarInstalacionDatos | None = None

    @field_validator("comentario")
    @classmethod
    def comentario_strip(cls, v: str | None) -> str | None:
        return v.strip() if v else None


class TareaResponse(BaseModel):
    id: int
    id_servicio: int | None
    tipo: TipoTarea
    prioridad: PrioridadTarea
    estado: EstadoTarea
    descripcion: str
    tecnico_id: int | None
    supervisor_id: int
    latitud: float | None
    longitud: float | None
    datos_instalacion: dict[str, Any] | None
    fecha_creada: datetime
    fecha_limite: datetime | None
    fecha_inicio: datetime | None
    fecha_fin: datetime | None
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
