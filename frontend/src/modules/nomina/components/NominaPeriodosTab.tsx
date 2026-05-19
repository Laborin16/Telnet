import { useState } from "react";
import { usePeriodos } from "../hooks/useNomina";
import { NominaPeriodoDetalleModal } from "./NominaPeriodoDetalleModal";
import { getSemanaISO, type EstadoPeriodo } from "../types/nomina";


export function NominaPeriodosTab() {
  const { data: periodos = [], isLoading } = usePeriodos();
  const [seleccionado, setSeleccionado] = useState<number | null>(null);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: "10px", overflow: "hidden" }}>
        {isLoading ? (
          <p style={{ padding: "18px", color: "#64748b" }}>Cargando…</p>
        ) : periodos.length === 0 ? (
          <p style={{ padding: "18px", color: "#94a3b8", fontSize: "13px" }}>Sin períodos aún.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                <th style={{ ...th, textAlign: "center", width: 70 }}>Semana</th>
                <th style={th}>Período</th>
                <th style={{ ...th, textAlign: "center" }}>Estado</th>
                <th style={{ ...th, textAlign: "right" }}>Empleados</th>
                <th style={{ ...th, textAlign: "right" }}>Total</th>
                <th style={{ ...th, textAlign: "right" }}>Pagada en</th>
              </tr>
            </thead>
            <tbody>
              {periodos.map(p => (
                <tr key={p.id}
                    onClick={() => setSeleccionado(p.id)}
                    style={{ borderBottom: "1px solid #f1f5f9", cursor: "pointer" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#f8fafc")}
                    onMouseLeave={e => (e.currentTarget.style.background = "white")}>
                  <td style={{ ...td, textAlign: "center", fontWeight: 700, color: "#0f172a", fontFamily: "monospace" }}>
                    {getSemanaISO(p.fecha_inicio)}
                  </td>
                  <td style={{ ...td, fontWeight: 600 }}>
                    {fmtDate(p.fecha_inicio)} – {fmtDate(p.fecha_fin)}
                  </td>
                  <td style={{ ...td, textAlign: "center" }}><EstadoBadge estado={p.estado} /></td>
                  <td style={{ ...td, textAlign: "right" }}>{p.total_empleados}</td>
                  <td style={{ ...td, textAlign: "right", fontWeight: 600, color: "#0f172a" }}>{fmtMoney(p.total_a_pagar)}</td>
                  <td style={{ ...td, textAlign: "right", color: "#94a3b8", fontSize: "11.5px" }}>
                    {p.closed_at ? new Date(p.closed_at).toLocaleDateString("es-MX") : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {seleccionado !== null && (
        <NominaPeriodoDetalleModal periodoId={seleccionado} onClose={() => setSeleccionado(null)} />
      )}
    </div>
  );
}


function EstadoBadge({ estado }: { estado: EstadoPeriodo }) {
  const c = estado === "CERRADA"
    ? { bg: "#ecfdf5", color: "#047857", border: "#a7f3d0", label: "Pagada" }
    : { bg: "#fef3c7", color: "#92400e", border: "#fde68a", label: "Por pagar" };
  return (
    <span style={{ padding: "2px 9px", borderRadius: "20px", fontSize: "10px", fontWeight: 600,
                   background: c.bg, color: c.color, border: `1px solid ${c.border}` }}>
      {c.label}
    </span>
  );
}


function fmtMoney(n: number): string {
  return `$${n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtDate(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("es-MX", { day: "2-digit", month: "short" });
}


const th: React.CSSProperties = { padding: "10px 12px", textAlign: "left", fontSize: "11px", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.04em" };
const td: React.CSSProperties = { padding: "11px 12px", color: "#334155" };
