import { useMemo, useState } from "react";
import { useMarcarPagado } from "../hooks/usePagosEmpresa";
import { RECURRENCIA_LABEL, type PagoEmpresa } from "../types/pagos_empresa";
import { useToast } from "../../../shared/hooks/useToast";


interface Props {
  pago: PagoEmpresa;
  onClose: () => void;
}


export function MarcarPagadoModal({ pago, onClose }: Props) {
  const [notas, setNotas]       = useState("");
  const [archivo, setArchivo]   = useState<File | null>(null);
  const marcar = useMarcarPagado();
  const { addToast } = useToast();

  const siguienteFecha = useMemo(() => calcularSiguienteFecha(pago.fecha_vencimiento, pago.recurrencia), [pago.fecha_vencimiento, pago.recurrencia]);

  function handleSubmit() {
    marcar.mutate(
      { id: pago.id, notas: notas.trim() || undefined, comprobante: archivo },
      {
        onSuccess: (data) => {
          if (data.siguiente) {
            addToast(`Pago marcado · Próxima instancia: ${fmtDate(data.siguiente.fecha_vencimiento)}`);
          } else {
            addToast("Pago marcado como pagado.");
          }
          onClose();
        },
        onError: (err: unknown) => {
          const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Error al marcar pago.";
          addToast(msg, "error");
        },
      },
    );
  }

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "white", borderRadius: 12, padding: 24, width: 460, maxWidth: "92vw", maxHeight: "92vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#0f172a" }}>Marcar como pagado</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "#94a3b8" }}>✕</button>
        </div>

        <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "12px 14px", marginBottom: 14 }}>
          <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: "#0f172a" }}>{pago.concepto}</p>
          <p style={{ margin: "3px 0 0", fontSize: 12, color: "#64748b" }}>
            {pago.categoria_nombre} · Vence {fmtDate(pago.fecha_vencimiento)}
          </p>
          <p style={{ margin: "8px 0 0", fontSize: 20, fontWeight: 700, color: "#0f172a" }}>{fmtMoney(pago.monto)}</p>
        </div>

        {pago.recurrencia !== "NINGUNA" && siguienteFecha && (
          <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 7, padding: "8px 12px", fontSize: 12, color: "#1d4ed8", marginBottom: 14 }}>
            Recurrencia <strong>{RECURRENCIA_LABEL[pago.recurrencia]}</strong>: se generará automáticamente la siguiente instancia con vencimiento <strong>{fmtDate(siguienteFecha)}</strong>.
          </div>
        )}

        <div style={{ marginBottom: 12 }}>
          <label style={lbl}>Comprobante <span style={{ fontWeight: 400, color: "#94a3b8" }}>(opcional)</span></label>
          <label style={fileLabel}>
            <input type="file" accept="image/*,.pdf" style={{ display: "none" }}
                   onChange={e => setArchivo(e.target.files?.[0] ?? null)} />
            {archivo
              ? <span style={{ color: "#1e40af", fontWeight: 600 }}>{archivo.name}</span>
              : <span style={{ color: "#94a3b8" }}>Seleccionar imagen o PDF…</span>}
          </label>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={lbl}>Notas <span style={{ fontWeight: 400, color: "#94a3b8" }}>(opcional)</span></label>
          <textarea value={notas} onChange={e => setNotas(e.target.value)} rows={3}
                    placeholder="Ej. referencia del depósito…"
                    style={{ ...inp, resize: "vertical" }} />
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onClose} style={btnSecondary}>Cancelar</button>
          <button onClick={handleSubmit} disabled={marcar.isPending}
                  style={{ ...btnPrimary, flex: 2 }}>
            {marcar.isPending ? "Marcando…" : "Confirmar pago"}
          </button>
        </div>
      </div>
    </div>
  );
}


function calcularSiguienteFecha(isoDate: string, rec: PagoEmpresa["recurrencia"]): string | null {
  if (rec === "NINGUNA") return null;
  const d = new Date(isoDate + "T00:00:00");
  if (rec === "SEMANAL")   d.setDate(d.getDate() + 7);
  if (rec === "QUINCENAL") d.setDate(d.getDate() + 15);
  if (rec === "MENSUAL") {
    const dia = d.getDate();
    d.setDate(1);
    d.setMonth(d.getMonth() + 1);
    const ultimo = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(dia, ultimo));
  }
  if (rec === "ANUAL")     d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

function fmtMoney(n: number): string { return `$${n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
function fmtDate(iso: string): string { return new Date(iso + "T00:00:00").toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" }); }


const lbl: React.CSSProperties = { display: "block", marginBottom: 4, fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.06em" };
const inp: React.CSSProperties = { width: "100%", boxSizing: "border-box", padding: "9px 11px", borderRadius: 7, border: "1px solid #e2e8f0", fontSize: 13, color: "#1e293b", background: "#f8fafc", outline: "none" };
const fileLabel: React.CSSProperties = { display: "flex", alignItems: "center", padding: "8px 12px", borderRadius: 6, border: "1px dashed #cbd5e1", backgroundColor: "#f8fafc", cursor: "pointer", fontSize: 13 };
const btnPrimary: React.CSSProperties = { padding: "9px 16px", borderRadius: 7, border: "none", background: "#16a34a", color: "white", fontSize: 13, fontWeight: 600, cursor: "pointer" };
const btnSecondary: React.CSSProperties = { flex: 1, padding: 9, borderRadius: 7, border: "1px solid #e2e8f0", background: "white", color: "#64748b", fontSize: 13, fontWeight: 600, cursor: "pointer" };
