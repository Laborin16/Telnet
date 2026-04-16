import { useMemo } from "react";
import { useHistorialPagos } from "./useCobranza";

export interface CuentaStat {
  nombre: string;
  monto: number;
  count: number;
}

export interface MetodosPagoStats {
  isLoading: boolean;
  efectivo: { monto: number; count: number };
  transferencia: CuentaStat[];
  deposito: CuentaStat[];
}

export function useMetodosPagoStats(search = ""): MetodosPagoStats {
  const { data, isLoading } = useHistorialPagos(search);

  return useMemo(() => {
    const empty: MetodosPagoStats = {
      isLoading,
      efectivo: { monto: 0, count: 0 },
      transferencia: [],
      deposito: [],
    };

    if (!data) return empty;

    const efectivo = { monto: 0, count: 0 };
    const transMap = new Map<string, CuentaStat>();
    const deposMap = new Map<string, CuentaStat>();

    for (const p of data.items) {
      const metodo = p.metodo_pago ?? "";
      const monto = p.monto ?? 0;

      if (metodo.startsWith("Efectivo")) {
        efectivo.monto += monto;
        efectivo.count += 1;
      } else if (metodo.startsWith("Transferencia")) {
        const cuenta = metodo.includes(" - ") ? metodo.split(" - ")[1] : "Sin especificar";
        const prev = transMap.get(cuenta) ?? { nombre: cuenta, monto: 0, count: 0 };
        prev.monto += monto;
        prev.count += 1;
        transMap.set(cuenta, prev);
      } else if (metodo.startsWith("Depósito")) {
        const cuenta = metodo.includes(" - ") ? metodo.split(" - ")[1] : "Sin especificar";
        const prev = deposMap.get(cuenta) ?? { nombre: cuenta, monto: 0, count: 0 };
        prev.monto += monto;
        prev.count += 1;
        deposMap.set(cuenta, prev);
      }
    }

    return {
      isLoading,
      efectivo,
      transferencia: [...transMap.values()].sort((a, b) => b.monto - a.monto),
      deposito: [...deposMap.values()].sort((a, b) => b.monto - a.monto),
    };
  }, [data, isLoading]);
}
