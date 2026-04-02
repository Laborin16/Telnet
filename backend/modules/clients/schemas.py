from pydantic import BaseModel, field_validator
from typing import Optional, Literal
from datetime import date, datetime
from decimal import Decimal


class PlanInternet(BaseModel):
    id: int
    nombre: str


class Zona(BaseModel):
    id: int
    nombre: str


class Router(BaseModel):
    id: int
    nombre: str
    falla_general: bool
    falla_general_descripcion: str


class Tecnico(BaseModel):
    id: int
    nombre: str


class ClientItem(BaseModel):
    id_servicio: int
    nombre: str
    direccion: Optional[str] = ""
    telefono: Optional[str] = ""
    ip: Optional[str] = ""
    estado: Literal["Activo", "Suspendido", "Cancelado"]
    estado_facturas: str
    saldo: Decimal
    precio_plan: Decimal
    fecha_corte: Optional[date] = None
    fecha_instalacion: Optional[datetime] = None
    fecha_cancelacion: Optional[datetime] = None
    dias_para_corte: Optional[int] = None
    alerta_corte: Optional[str] = None
    plan_internet: Optional[PlanInternet] = None
    zona: Optional[Zona] = None
    router: Optional[Router] = None
    tecnico: Optional[Tecnico] = None

    @field_validator("fecha_corte", mode="before")
    @classmethod
    def parse_fecha_corte(cls, v):
        if not v:
            return None
        try:
            return datetime.strptime(v, "%d/%m/%Y").date()
        except ValueError:
            return None

    @field_validator("fecha_instalacion", "fecha_cancelacion", mode="before")
    @classmethod
    def parse_fechas_datetime(cls, v):
        if not v:
            return None
        try:
            return datetime.strptime(v, "%d/%m/%Y %H:%M:%S")
        except ValueError:
            return None


class ClientListResponse(BaseModel):
    count: int
    next: Optional[str] = None
    previous: Optional[str] = None
    results: list[ClientItem]