import { useMemo } from "react";
import { useAllClients } from "../../clients/hooks/useAllClients";
import type { ClientItem } from "../../../core/types/client";

function inRange(dateStr: string | null, from: string | null, to: string | null): boolean {
  if (!dateStr) return false;
  const d = dateStr.slice(0, 10);
  if (from && d < from) return false;
  if (to && d > to) return false;
  return true;
}

function groupByName<T extends { nombre: string }>(
  items: ClientItem[],
  getEntity: (c: ClientItem) => T | null
): { nombre: string; count: number }[] {
  const map = new Map<string, { nombre: string; count: number }>();
  for (const c of items) {
    const entity = getEntity(c);
    if (!entity) continue;
    const key = entity.nombre;
    const prev = map.get(key);
    if (prev) prev.count++;
    else map.set(key, { nombre: entity.nombre, count: 1 });
  }
  return Array.from(map.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
}

export interface DashboardStats {
  isLoading: boolean;
  isError: boolean;
  total: number;
  activos: number;
  suspendidos: number;
  recoleccion: number;
  cancelados: number;
  mrrActivo: number;
  mrrSuspendido: number;
  riesgoCorte: { critico: number; pendiente: number };
  alertaBreakdown: { normal: number; critico: number; pendiente: number; suspendido: number };
  planBreakdown: { nombre: string; count: number }[];
  zonaBreakdown: { nombre: string; count: number }[];
  periodStats: { nuevasInstalaciones: number; cancelaciones: number; crecimientoNeto: number };
}

export function useDashboardStats(dateFrom: string | null, dateTo: string | null, recoleccionIds: Set<number> = new Set()): DashboardStats {
  const { data: clients, isLoading, isError } = useAllClients();

  return useMemo(() => {
    const empty: DashboardStats = {
      isLoading,
      isError,
      total: 0,
      activos: 0,
      suspendidos: 0,
      recoleccion: 0,
      cancelados: 0,
      mrrActivo: 0,
      mrrSuspendido: 0,
      riesgoCorte: { critico: 0, pendiente: 0 },
      alertaBreakdown: { normal: 0, critico: 0, pendiente: 0, suspendido: 0 },
      planBreakdown: [],
      zonaBreakdown: [],
      periodStats: { nuevasInstalaciones: 0, cancelaciones: 0, crecimientoNeto: 0 },
    };

    if (!clients) return empty;

    let activos = 0, suspendidos = 0, recoleccion = 0, cancelados = 0;
    let mrrActivo = 0, mrrSuspendido = 0;
    const riesgoCorte = { critico: 0, pendiente: 0 };
    const alertaBreakdown = { normal: 0, critico: 0, pendiente: 0, suspendido: 0 };
    let nuevasInstalaciones = 0, cancelaciones = 0;

    for (const c of clients) {
      if (c.estado === "Activo") {
        activos++;
        mrrActivo += c.precio_plan ?? 0;
        if (c.alerta_corte === "critico") riesgoCorte.critico++;
        if (c.alerta_corte === "pendiente") riesgoCorte.pendiente++;
      } else if (c.estado === "Suspendido") {
        if (recoleccionIds.has(c.id_servicio)) {
          recoleccion++;
        } else {
          suspendidos++;
        }
        mrrSuspendido += c.precio_plan ?? 0;
      } else if (c.estado === "Cancelado") {
        cancelados++;
      }
      if (c.alerta_corte && c.alerta_corte in alertaBreakdown) {
        alertaBreakdown[c.alerta_corte as keyof typeof alertaBreakdown]++;
      }

      if (inRange(c.fecha_instalacion, dateFrom, dateTo)) nuevasInstalaciones++;
      if (c.estado === "Cancelado" && inRange(c.fecha_cancelacion, dateFrom, dateTo)) cancelaciones++;
    }

    const hasPeriod = dateFrom || dateTo;
    const clientsForBreakdown = hasPeriod
      ? clients.filter((c) => inRange(c.fecha_instalacion, dateFrom, dateTo))
      : clients;

    return {
      isLoading,
      isError,
      total: clients.length,
      activos,
      suspendidos,
      recoleccion,
      cancelados,
      mrrActivo,
      mrrSuspendido,
      riesgoCorte,
      alertaBreakdown,
      planBreakdown: groupByName(clientsForBreakdown, (c) => c.plan_internet),
      zonaBreakdown: groupByName(clientsForBreakdown, (c) => c.zona),
      periodStats: {
        nuevasInstalaciones,
        cancelaciones,
        crecimientoNeto: nuevasInstalaciones - cancelaciones,
      },
    };
  }, [clients, isLoading, isError, dateFrom, dateTo, recoleccionIds]);
}
