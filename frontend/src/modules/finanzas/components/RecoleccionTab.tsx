import { useMemo, useState } from "react";
import { useRecoleccion, useObservaciones, type ItemRecoleccion } from "../hooks/useCobranza";
import { useDebounce } from "../../../shared/hooks/useDebounce";
import { ObservacionCell } from "./ObservacionCell";
import { RecoleccionModal } from "./RecoleccionModal";

// ── Vista compartida de recolección ──────────────────────────────────────────
//
// Self-contained: maneja su propio fetch, filtros, búsqueda y modal.
// Se usa tanto en Finanzas como en Tareas (solo admin/supervisor).

export function RecoleccionTab() {
  const { data: recoleccion, isLoading: recoleccionLoading } = useRecoleccion();

  const [itemRecoleccion, setItemRecoleccion]     = useState<ItemRecoleccion | null>(null);
  const [filtrosRecoleccion, setFiltrosRecoleccion] = useState<Set<string>>(new Set());
  const [searchRecoleccion, setSearchRecoleccion]   = useState("");
  const dSearchRecoleccion = useDebounce(searchRecoleccion, 200);

  const toggleFiltroRecoleccion = (key: string) => {
    setFiltrosRecoleccion(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const itemsFiltrados = useMemo(() => {
    if (!recoleccion?.items) return [];
    const ORDEN_ESTADO: Record<string, number> = {
      recuperado: 0, antena_no_recuperada: 1, modem_no_recuperado: 2, nada_recuperado: 3,
    };
    let items = recoleccion.items;
    if (dSearchRecoleccion) {
      const q = dSearchRecoleccion.toLowerCase();
      items = items.filter(i =>
        i.nombre.toLowerCase().includes(q) ||
        i.telefono?.toLowerCase().includes(q) ||
        String(i.id_servicio).includes(dSearchRecoleccion)
      );
    }
    if (filtrosRecoleccion.size > 0) {
      items = items.filter(i => i.estado_equipo != null && filtrosRecoleccion.has(i.estado_equipo));
    }
    if (filtrosRecoleccion.size <= 1) return items;
    return [...items].sort((a, b) => {
      const oa = ORDEN_ESTADO[a.estado_equipo ?? ""] ?? 99;
      const ob = ORDEN_ESTADO[b.estado_equipo ?? ""] ?? 99;
      if (oa !== ob) return oa - ob;
      return b.dias_vencido - a.dias_vencido;
    });
  }, [recoleccion, filtrosRecoleccion, dSearchRecoleccion]);

  const idsRecoleccion = useMemo(
    () => recoleccion?.items.map(i => i.id_servicio) ?? [],
    [recoleccion],
  );
  const { data: obsRecoleccion } = useObservaciones("recoleccion", idsRecoleccion, true);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <p style={sectionLabel}>Clientes en recolección</p>
          <span style={{ fontSize: "13px", color: "#64748b" }}>
            {recoleccion?.total ?? 0} cliente{recoleccion?.total !== 1 ? "s" : ""} con 7+ días vencidos
          </span>
        </div>
      </div>

      <div style={{ display: "flex", gap: "12px", marginBottom: "4px", flexWrap: "wrap" }}>
        <input
          type="text"
          placeholder="Buscar por nombre, teléfono o ID..."
          value={searchRecoleccion}
          onChange={(e) => setSearchRecoleccion(e.target.value)}
          style={searchInput}
        />
      </div>

      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontSize: "12px", color: "#94a3b8", fontWeight: 600 }}>Estado equipo:</span>
        {([
          { key: "recuperado",           label: "Todo recuperado",       color: "#16a34a" },
          { key: "antena_no_recuperada", label: "Antena no recuperada",  color: "#2563eb" },
          { key: "modem_no_recuperado",  label: "Modem no recuperado",   color: "#d97706" },
          { key: "nada_recuperado",      label: "Nada recuperado",       color: "#dc2626" },
        ] as const).map(({ key, label, color }) => {
          const activo = filtrosRecoleccion.has(key);
          return (
            <button
              key={key}
              onClick={() => toggleFiltroRecoleccion(key)}
              style={{
                padding: "4px 12px", borderRadius: "20px",
                border: `1px solid ${activo ? color : "#e2e8f0"}`,
                backgroundColor: activo ? color : "white",
                color: activo ? "white" : "#475569",
                fontSize: "12px", fontWeight: activo ? 600 : 400, cursor: "pointer",
              }}
            >
              {label}
            </button>
          );
        })}
        {filtrosRecoleccion.size > 0 && (
          <button
            onClick={() => setFiltrosRecoleccion(new Set())}
            style={{
              padding: "4px 12px", borderRadius: "20px", border: "1px solid #e2e8f0",
              backgroundColor: "white", color: "#94a3b8", fontSize: "12px", cursor: "pointer",
            }}
          >
            Limpiar
          </button>
        )}
      </div>

      {recoleccionLoading && <p style={{ color: "#64748b" }}>Cargando...</p>}

      {recoleccion && (
        <div style={{ overflowX: "auto" }}>
          <table style={tableStyle}>
            <thead>
              <tr style={{ backgroundColor: "#f5f3ff" }}>
                <th style={th}>ID</th>
                <th style={th}>Cliente</th>
                <th style={th}>Dirección</th>
                <th style={th}>Teléfono</th>
                <th style={th}>Técnico</th>
                <th style={th}>Días vencido</th>
                <th style={th}>Total</th>
                <th style={th}>Observaciones</th>
                <th style={th}>Acción</th>
              </tr>
            </thead>
            <tbody>
              {itemsFiltrados.map((item) => (
                <tr key={item.id_servicio} style={{ borderBottom: "1px solid #e2e8f0" }}>
                  <td style={{ ...td, color: "#94a3b8", fontSize: "12px" }}>{item.id_servicio}</td>
                  <td style={td}>{item.nombre}</td>
                  <td style={td}>{item.direccion || "—"}</td>
                  <td style={td}>{item.telefono || "—"}</td>
                  <td style={{ ...td, color: item.nombre_tecnico ? "#1e293b" : "#94a3b8", fontSize: item.nombre_tecnico ? "14px" : "12px" }}>
                    {item.nombre_tecnico || "Sin asignar"}
                  </td>
                  <td style={{ ...td, fontWeight: 700, color: "#7c3aed" }}>{item.dias_vencido} días</td>
                  <td style={{ ...td, fontWeight: 600 }}>${item.total.toFixed(2)}</td>
                  <ObservacionCell entityType="recoleccion" entityId={item.id_servicio} value={obsRecoleccion?.[item.id_servicio] ?? item.notas} />
                  <td style={td}>
                    {(() => {
                      const ESTADO_CONFIG: Record<string, { label: string; bg: string }> = {
                        recuperado:           { label: "Todo recuperado",      bg: "#16a34a" },
                        antena_no_recuperada: { label: "Antena no recuperada", bg: "#2563eb" },
                        modem_no_recuperado:  { label: "Módem no recuperado",  bg: "#d97706" },
                        nada_recuperado:      { label: "Nada recuperado",      bg: "#dc2626" },
                      };
                      const cfg = item.estado_equipo ? ESTADO_CONFIG[item.estado_equipo] : null;
                      return (
                        <button
                          onClick={() => setItemRecoleccion(item)}
                          style={{
                            padding: "4px 12px", borderRadius: "6px", border: "none",
                            backgroundColor: cfg ? cfg.bg : "#7c3aed",
                            color: "white", fontSize: "12px", fontWeight: 600, cursor: "pointer",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {cfg ? cfg.label : "Sin gestionar"}
                        </button>
                      );
                    })()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {itemsFiltrados.length === 0 && (
            <p style={{ textAlign: "center", padding: "32px", color: "#94a3b8", fontSize: "14px" }}>
              {filtrosRecoleccion.size > 0
                ? "No hay clientes con ese estado de equipo."
                : "No hay clientes en recolección."}
            </p>
          )}
        </div>
      )}

      {itemRecoleccion && (
        <RecoleccionModal
          item={itemRecoleccion}
          onClose={() => setItemRecoleccion(null)}
        />
      )}
    </div>
  );
}

// ── Estilos locales ──────────────────────────────────────────────────────────

const searchInput: React.CSSProperties = {
  fontSize: "13px", padding: "6px 12px", borderRadius: "8px",
  border: "1px solid #e2e8f0", backgroundColor: "#f8fafc",
  color: "#1e293b", outline: "none", flex: "1 1 180px", minWidth: "0",
};
const tableStyle: React.CSSProperties = { width: "100%", borderCollapse: "collapse", fontSize: "14px" };
const sectionLabel: React.CSSProperties = {
  fontSize: "11px", fontWeight: 700, color: "#94a3b8",
  textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 10px 0",
};
const th: React.CSSProperties = { padding: "10px 16px", fontWeight: 600, fontSize: "13px", color: "#475569", textAlign: "left" };
const td: React.CSSProperties = { padding: "10px 16px", color: "#1e293b", textAlign: "left" };
