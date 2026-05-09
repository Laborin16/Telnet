import enum


class TipoTarea(str, enum.Enum):
    INSTALACION      = "INSTALACION"
    SERVICIO         = "SERVICIO"
    RECOLECCION      = "RECOLECCION"
    RECONEXION       = "RECONEXION"
    CAMBIO_DOMICILIO = "CAMBIO_DOMICILIO"
    # Valores legacy — solo para compatibilidad con tareas existentes en DB
    FALLA_RED        = "FALLA_RED"
    SOPORTE_TECNICO  = "SOPORTE_TECNICO"
    MANTENIMIENTO    = "MANTENIMIENTO"
    CAMBIO_PLAN      = "CAMBIO_PLAN"
    REUBICACION      = "REUBICACION"


class EstadoTarea(str, enum.Enum):
    PENDIENTE = "PENDIENTE"
    ASIGNADO = "ASIGNADO"
    EN_RUTA = "EN_RUTA"
    EN_EJECUCION = "EN_EJECUCION"
    BLOQUEADO = "BLOQUEADO"
    COMPLETADO = "COMPLETADO"
    CANCELADO = "CANCELADO"


class PrioridadTarea(str, enum.Enum):
    ALTA = "ALTA"
    MEDIA = "MEDIA"
    BAJA = "BAJA"
