import { useState } from "react";
import { useEliminarPago, usePagos } from "../hooks/usePagosEmpresa";
import { RECURRENCIA_LABEL, type PagoEmpresa } from "../types/pagos_empresa";
import { useToast } from "../../../shared/hooks/useToast";
import { PagoFormModal } from "./PagoFormModal";
import { MarcarPagadoModal } from "./MarcarPagadoModal";


type EstadoFiltro = "todos" | "pendiente" | "pagado";

interface Props {
  categoriaId?: number;
  archivadas?: boolean;  // true: solo lectura, muestra pagos de categorías inactivas
}

export function PagosTabla({ categoriaId, archivadas = false }: Props) {
  const [estadoFiltro, setEstadoFiltro] = useState<EstadoFiltro>("todos");
  const [editando, setEditando] = useState<PagoEmpresa | null>(null);
  const [creandoEnCategoria, setCreandoEnCategoria] = useState<number | null>(null);
  const [pagando, setPagando] = useState<PagoEmpresa | null>(null);
  const [confirmarEliminar, setConfirmarEliminar] = useState<PagoEmpresa | null>(null);

  const params = archivadas
    ? { archivadas: true }
    : { categoria_id: categoriaId, estado: estadoFiltro === "todos" ? undefined : estadoFiltro.toUpperCase() };

  const { data: pagos = [], isLoading } = usePagos(params, !!categoriaId || archivadas);
  const eliminar = useEliminarPago();
  const { addToast } = useToast();

  function handleEliminar() {
    if (!confirmarEliminar) return;
    eliminar.mutate(confirmarEliminar.id, {
      onSuccess: () => { setConfirmarEliminar(null); addToast("Pago eliminado."); },
      onError: () => addToast("Error al eliminar el pago.", "error"),
    });
  }

  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const ms2dias = 2 * 24 * 60 * 60 * 1000;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        {!archivadas && (
          <div style={{ display: "flex", gap: 6 }}>
            <FilterBtn active={estadoFiltro === "todos"}     onClick={() => setEstadoFiltro("todos")}>Todos</FilterBtn>
            <FilterBtn active={estadoFiltro === "pendiente"} onClick={() => setEstadoFiltro("pendiente")}>Pendientes</FilterBtn>
            <FilterBtn active={estadoFiltro === "pagado"}    onClick={() => setEstadoFiltro("pagado")}>Pagados</FilterBtn>
          </div>
        )}
        {!archivadas && categoriaId && (
          <button onClick={() => setCreandoEnCategoria(categoriaId)} style={btnPrimary}>+ Nuevo pago</button>
        )}
      </div>

      <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden" }}>
        {isLoading ? (
          <p style={{ padding: 18, color: "#64748b" }}>Cargando…</p>
        ) : pagos.length === 0 ? (
          <p style={{ padding: 18, color: "#94a3b8", fontSize: 13 }}>
            {archivadas ? "No hay pagos archivados." : "No hay pagos en esta categoría."}
          </p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                {archivadas && <th style={th}>Categoría</th>}
                <th style={th}>Concepto</th>
                <th style={{ ...th, textAlign: "right" }}>Monto</th>
                <th style={{ ...th, textAlign: "center" }}>Vencimiento</th>
                <th style={{ ...th, textAlign: "center" }}>Recurrencia</th>
                <th style={{ ...th, textAlign: "center" }}>Estado</th>
                <th style={th}>Proveedor</th>
                <th style={{ ...th, textAlign: "right" }}></th>
              </tr>
            </thead>
            <tbody>
              {pagos.map(p => {
                const venc = new Date(p.fecha_vencimiento + "T00:00:00");
                const venceEnDias = Math.floor((venc.getTime() - hoy.getTime()) / (24 * 60 * 60 * 1000));
                // Vence hoy o pasado = vencido. Vence mañana o pasado-mañana = vence pronto.
                const vencido = p.estado === "PENDIENTE" && venceEnDias <= 0;
                const proximo = p.estado === "PENDIENTE" && !vencido && (venc.getTime() - hoy.getTime()) <= ms2dias;
                return (
                  <tr key={p.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    {archivadas && <td style={{ ...td, color: "#94a3b8", fontSize: 11 }}>{p.categoria_nombre}</td>}
                    <td style={{ ...td, fontWeight: 600 }}>{p.concepto}</td>
                    <td style={{ ...td, textAlign: "right", fontWeight: 600 }}>{fmtMoney(p.monto)}</td>
                    <td style={{ ...td, textAlign: "center" }}>
                      <div>{fmtDate(p.fecha_vencimiento)}</div>
                      {vencido && (
                        <span style={{ fontSize: 10, padding: "1px 6px", background: "#fee2e2", color: "#dc2626", borderRadius: 10, fontWeight: 600 }}>Vencido</span>
                      )}
                      {proximo && (
                        <span style={{ fontSize: 10, padding: "1px 6px", background: "#fef3c7", color: "#92400e", borderRadius: 10, fontWeight: 600 }}>Vence pronto</span>
                      )}
                    </td>
                    <td style={{ ...td, textAlign: "center", fontSize: 11, color: "#64748b" }}>
                      {RECURRENCIA_LABEL[p.recurrencia]}
                    </td>
                    <td style={{ ...td, textAlign: "center" }}>
                      <EstadoBadge estado={p.estado} />
                    </td>
                    <td style={{ ...td, color: "#64748b", fontSize: 12 }}>{p.proveedor || "—"}</td>
                    <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>
                      {p.comprobante_url && (
                        <a href={`${import.meta.env.VITE_API_URL ?? ""}${p.comprobante_url}`} target="_blank" rel="noreferrer"
                           style={{ ...btnLink, marginRight: 8 }}>📄</a>
                      )}
                      {!archivadas && p.estado === "PENDIENTE" && (
                        <>
                          <button onClick={() => setPagando(p)} style={btnSuccess}>Marcar pagado</button>
                          <button onClick={() => setEditando(p)} style={{ ...btnSecondary, marginLeft: 6 }}>Editar</button>
                        </>
                      )}
                      {!archivadas && (
                        <button onClick={() => setConfirmarEliminar(p)} style={{ ...btnDangerMini, marginLeft: 6 }}>Eliminar</button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {creandoEnCategoria !== null && (
        <PagoFormModal
          categoriaId={creandoEnCategoria}
          onClose={() => setCreandoEnCategoria(null)}
        />
      )}
      {editando && (
        <PagoFormModal
          categoriaId={editando.categoria_id}
          pago={editando}
          onClose={() => setEditando(null)}
        />
      )}
      {pagando && (
        <MarcarPagadoModal
          pago={pagando}
          onClose={() => setPagando(null)}
        />
      )}
      {confirmarEliminar && (
        <ConfirmacionModal
          mensaje={`¿Eliminar el pago "${confirmarEliminar.concepto}"? Esta acción no se puede deshacer.`}
          onConfirm={handleEliminar}
          onClose={() => setConfirmarEliminar(null)}
          loading={eliminar.isPending}
        />
      )}
    </div>
  );
}


function EstadoBadge({ estado }: { estado: "PENDIENTE" | "PAGADO" }) {
  const c = estado === "PAGADO"
    ? { bg: "#ecfdf5", color: "#047857", border: "#a7f3d0", label: "Pagado" }
    : { bg: "#fef3c7", color: "#92400e", border: "#fde68a", label: "Pendiente" };
  return (
    <span style={{ padding: "2px 9px", borderRadius: 20, fontSize: 10, fontWeight: 600,
                   background: c.bg, color: c.color, border: `1px solid ${c.border}` }}>
      {c.label}
    </span>
  );
}


function FilterBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{
      padding: "6px 14px", borderRadius: 7, border: "1px solid",
      borderColor: active ? "#2563eb" : "#e2e8f0", background: active ? "#eff6ff" : "white",
      color: active ? "#1d4ed8" : "#64748b", fontSize: 12, fontWeight: 600, cursor: "pointer",
    }}>{children}</button>
  );
}


function ConfirmacionModal({ mensaje, onConfirm, onClose, loading }: { mensaje: string; onConfirm: () => void; onClose: () => void; loading: boolean }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "white", borderRadius: 10, padding: 20, width: 420, maxWidth: "92vw", boxShadow: "0 20px 60px rgba(0,0,0,0.22)" }}>
        <p style={{ margin: "0 0 16px", fontSize: 13, color: "#334155", lineHeight: 1.5 }}>{mensaje}</p>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 8, borderRadius: 6, border: "1px solid #e2e8f0", background: "white", color: "#64748b", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Cancelar</button>
          <button onClick={onConfirm} disabled={loading} style={{ flex: 1, padding: 8, borderRadius: 6, border: "none", background: "#dc2626", color: "white", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            {loading ? "Eliminando…" : "Eliminar"}
          </button>
        </div>
      </div>
    </div>
  );
}


function fmtMoney(n: number): string { return `$${n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
function fmtDate(iso: string): string { return new Date(iso + "T00:00:00").toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" }); }


const th: React.CSSProperties = { padding: "10px 12px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.04em" };
const td: React.CSSProperties = { padding: "10px 12px", color: "#334155" };
const btnPrimary: React.CSSProperties = { padding: "8px 14px", borderRadius: 7, border: "none", background: "#2563eb", color: "white", fontSize: 13, fontWeight: 600, cursor: "pointer" };
const btnSecondary: React.CSSProperties = { padding: "4px 10px", borderRadius: 6, border: "1px solid #e2e8f0", background: "white", color: "#475569", fontSize: 11.5, fontWeight: 600, cursor: "pointer" };
const btnSuccess: React.CSSProperties = { padding: "4px 10px", borderRadius: 6, border: "none", background: "#16a34a", color: "white", fontSize: 11.5, fontWeight: 600, cursor: "pointer" };
const btnDangerMini: React.CSSProperties = { padding: "4px 10px", borderRadius: 6, border: "1px solid #fecaca", background: "#fef2f2", color: "#dc2626", fontSize: 11.5, fontWeight: 600, cursor: "pointer" };
const btnLink: React.CSSProperties = { background: "none", border: "none", color: "#2563eb", fontSize: 14, fontWeight: 600, cursor: "pointer", padding: 0, textDecoration: "none" };
