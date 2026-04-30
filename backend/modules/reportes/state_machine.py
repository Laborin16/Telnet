from modules.reportes.enums import EstadoTarea

TRANSICIONES_VALIDAS: dict[EstadoTarea, set[EstadoTarea]] = {
    EstadoTarea.PENDIENTE:    {EstadoTarea.ASIGNADO, EstadoTarea.CANCELADO},
    EstadoTarea.ASIGNADO:     {EstadoTarea.EN_RUTA, EstadoTarea.PENDIENTE, EstadoTarea.CANCELADO},
    EstadoTarea.EN_RUTA:      {EstadoTarea.EN_EJECUCION, EstadoTarea.BLOQUEADO, EstadoTarea.CANCELADO},
    EstadoTarea.EN_EJECUCION: {EstadoTarea.COMPLETADO, EstadoTarea.BLOQUEADO, EstadoTarea.CANCELADO},
    EstadoTarea.BLOQUEADO:    {EstadoTarea.EN_RUTA, EstadoTarea.EN_EJECUCION, EstadoTarea.CANCELADO},
    EstadoTarea.COMPLETADO:   set(),
    EstadoTarea.CANCELADO:    set(),
}


def validar_transicion(
    estado_actual: EstadoTarea,
    estado_nuevo: EstadoTarea,
    comentario: str | None = None,
) -> None:
    destinos = TRANSICIONES_VALIDAS.get(estado_actual, set())
    if estado_nuevo not in destinos:
        nombres = ", ".join(d.value for d in destinos) if destinos else "ninguno"
        raise ValueError(
            f"Transición inválida: {estado_actual.value} → {estado_nuevo.value}. "
            f"Desde {estado_actual.value} solo se puede pasar a: {nombres}"
        )
    if estado_nuevo == EstadoTarea.BLOQUEADO and not comentario:
        raise ValueError("Bloquear una tarea requiere un comentario explicando el motivo")


def estados_siguientes(estado_actual: EstadoTarea) -> set[EstadoTarea]:
    """Devuelve los estados a los que puede transicionar el estado actual."""
    return TRANSICIONES_VALIDAS.get(estado_actual, set())
