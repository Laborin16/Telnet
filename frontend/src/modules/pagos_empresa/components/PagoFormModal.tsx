import { useState } from "react";
import { useActualizarPago, useCrearPago } from "../hooks/usePagosEmpresa";
import { RECURRENCIA_LABEL, type PagoEmpresa, type RecurrenciaPago } from "../types/pagos_empresa";
import { useToast } from "../../../shared/hooks/useToast";


interface Props {
  categoriaId: number;
  pago?: PagoEmpresa;  // si viene, es edición
  onClose: () => void;
}


export function PagoFormModal({ categoriaId, pago, onClose }: Props) {
  const esEdicion = !!pago;
  const [concepto, setConcepto]             = useState(pago?.concepto ?? "");
  const [monto, setMonto]                   = useState(pago ? String(pago.monto) : "");
  const [fechaVenc, setFechaVenc]           = useState(pago?.fecha_vencimiento ?? new Date().toISOString().slice(0, 10));
  const [recurrencia, setRecurrencia]       = useState<RecurrenciaPago>(pago?.recurrencia ?? "NINGUNA");
  const [proveedor, setProveedor]           = useState(pago?.proveedor ?? "");
  const [notas, setNotas]                   = useState(pago?.notas ?? "");

  const crear = useCrearPago();
  const actualizar = useActualizarPago();
  const { addToast } = useToast();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const montoNum = parseFloat(monto);
    if (!concepto.trim() || !montoNum || montoNum <= 0 || !fechaVenc) return;

    const payload = {
      categoria_id: categoriaId,
      concepto: concepto.trim(),
      monto: montoNum,
      fecha_vencimiento: fechaVenc,
      recurrencia,
      proveedor: proveedor.trim() || undefined,
      notas: notas.trim() || undefined,
    };

    if (esEdicion && pago) {
      actualizar.mutate(
        { id: pago.id, payload },
        {
          onSuccess: () => { addToast("Pago actualizado."); onClose(); },
          onError: (err: unknown) => {
            const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Error al actualizar.";
            addToast(msg, "error");
          },
        },
      );
    } else {
      crear.mutate(payload, {
        onSuccess: () => { addToast("Pago creado."); onClose(); },
        onError: (err: unknown) => {
          const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Error al crear.";
          addToast(msg, "error");
        },
      });
    }
  }

  const pending = crear.isPending || actualizar.isPending;

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "white", borderRadius: 12, padding: 24, width: 480, maxWidth: "92vw", maxHeight: "92vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#0f172a" }}>
            {esEdicion ? "Editar pago" : "Nuevo pago"}
          </h2>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "#94a3b8" }}>✕</button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={lbl}>Concepto</label>
            <input value={concepto} onChange={e => setConcepto(e.target.value)} required maxLength={200}
                   placeholder="Ej. Luz CFE oficina"
                   style={inp} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label style={lbl}>Monto</label>
              <input type="number" min="0" step="0.01" value={monto} onChange={e => setMonto(e.target.value)} required
                     placeholder="0.00" style={inp} />
            </div>
            <div>
              <label style={lbl}>Vencimiento</label>
              <input type="date" value={fechaVenc} onChange={e => setFechaVenc(e.target.value)} required style={inp} />
            </div>
          </div>
          <div>
            <label style={lbl}>Recurrencia</label>
            <select value={recurrencia} onChange={e => setRecurrencia(e.target.value as RecurrenciaPago)} style={inp}>
              {(Object.entries(RECURRENCIA_LABEL) as [RecurrenciaPago, string][]).map(([k, l]) => (
                <option key={k} value={k}>{l}</option>
              ))}
            </select>
            {recurrencia !== "NINGUNA" && (
              <p style={{ margin: "3px 0 0", fontSize: 11, color: "#94a3b8" }}>
                Al marcar como pagado se generará automáticamente la siguiente instancia.
              </p>
            )}
          </div>
          <div>
            <label style={lbl}>Proveedor <span style={{ fontWeight: 400, color: "#94a3b8" }}>(opcional)</span></label>
            <input value={proveedor} onChange={e => setProveedor(e.target.value)} placeholder="Ej. CFE" style={inp} />
          </div>
          <div>
            <label style={lbl}>Notas <span style={{ fontWeight: 400, color: "#94a3b8" }}>(opcional)</span></label>
            <textarea value={notas} onChange={e => setNotas(e.target.value)} rows={3}
                      placeholder="Detalles adicionales…"
                      style={{ ...inp, resize: "vertical" }} />
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <button type="button" onClick={onClose} style={btnSecondary}>Cancelar</button>
            <button type="submit" disabled={pending} style={{ ...btnPrimary, flex: 2 }}>
              {pending ? "Guardando…" : esEdicion ? "Guardar cambios" : "Crear pago"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


const lbl: React.CSSProperties = { display: "block", marginBottom: 4, fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.06em" };
const inp: React.CSSProperties = { width: "100%", boxSizing: "border-box", padding: "9px 11px", borderRadius: 7, border: "1px solid #e2e8f0", fontSize: 13, color: "#1e293b", background: "#f8fafc", outline: "none" };
const btnPrimary: React.CSSProperties = { padding: "9px 16px", borderRadius: 7, border: "none", background: "#2563eb", color: "white", fontSize: 13, fontWeight: 600, cursor: "pointer" };
const btnSecondary: React.CSSProperties = { flex: 1, padding: 9, borderRadius: 7, border: "1px solid #e2e8f0", background: "white", color: "#64748b", fontSize: 13, fontWeight: 600, cursor: "pointer" };
