import { useState } from "react";
import { useRegistrarPagoWispHub } from "../hooks/useCobranza";
import type { ClienteAlerta } from "../hooks/useCobranza";

const FORMAS_PAGO = [
  { id: 82219, nombre: "Efectivo" },
  { id: 84091, nombre: "Tarjeta" },
  { id: 82222, nombre: "Transferencia Bancaria" },
];

interface Props {
  cliente: ClienteAlerta & { id_factura: number; total: number };
  onClose: () => void;
}

export function PagoModal({ cliente, onClose }: Props) {
  const [monto, setMonto] = useState<string>(String(cliente.total));
  const [formaPago, setFormaPago] = useState<number>(82219);
  const { mutate, isPending, isSuccess, error } = useRegistrarPagoWispHub();

  function handleSubmit() {
    const montoNum = parseFloat(monto);
    if (!montoNum || montoNum <= 0) return;
    mutate(
      { id_factura: cliente.id_factura, monto: montoNum, forma_pago: formaPago },
      { onSuccess: () => setTimeout(onClose, 1500) }
    );
  }

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#1e293b", margin: 0 }}>
            Registrar Pago
          </h2>
          <button onClick={onClose} style={closeBtn}>✕</button>
        </div>

        <div style={infoBox}>
          <p style={infoLabel}>Cliente</p>
          <p style={infoValue}>{cliente.nombre}</p>
          <p style={infoLabel}>Factura #{cliente.id_factura}</p>
          <p style={infoValue}>Vencida hace {cliente.dias_vencido} día{cliente.dias_vencido !== 1 ? "s" : ""}</p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "14px", marginTop: "16px" }}>
          <div>
            <label style={labelStyle}>Monto a cobrar</label>
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#64748b", fontSize: "14px" }}>$</span>
              <input
                type="number"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                style={{ ...inputStyle, paddingLeft: "28px" }}
                min="0"
                step="0.01"
              />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Forma de pago</label>
            <select
              value={formaPago}
              onChange={(e) => setFormaPago(Number(e.target.value))}
              style={inputStyle}
            >
              {FORMAS_PAGO.map((f) => (
                <option key={f.id} value={f.id}>{f.nombre}</option>
              ))}
            </select>
          </div>
        </div>

        {isSuccess && (
          <div style={{ marginTop: "16px", padding: "10px 14px", backgroundColor: "#f0fdf4", borderRadius: "8px", color: "#16a34a", fontSize: "13px", fontWeight: 600 }}>
            ✅ Pago registrado correctamente en WispHub
          </div>
        )}

        {error && (
          <div style={{ marginTop: "16px", padding: "10px 14px", backgroundColor: "#fef2f2", borderRadius: "8px", color: "#dc2626", fontSize: "13px" }}>
            Error al registrar el pago. Intenta de nuevo.
          </div>
        )}

        <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
          <button onClick={onClose} style={cancelBtn}>Cancelar</button>
          <button
            onClick={handleSubmit}
            disabled={isPending || isSuccess}
            style={submitBtn(isPending || isSuccess)}
          >
            {isPending ? "Registrando..." : "Confirmar Pago"}
          </button>
        </div>
      </div>
    </div>
  );
}

const overlay: React.CSSProperties = {
  position: "fixed", inset: 0,
  backgroundColor: "rgba(0,0,0,0.4)",
  display: "flex", alignItems: "center", justifyContent: "center",
  zIndex: 1000,
};

const modal: React.CSSProperties = {
  backgroundColor: "white",
  borderRadius: "12px",
  padding: "24px",
  width: "420px",
  maxWidth: "90vw",
  boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
};

const closeBtn: React.CSSProperties = {
  background: "none", border: "none",
  fontSize: "18px", cursor: "pointer",
  color: "#94a3b8", padding: "4px 8px",
};

const infoBox: React.CSSProperties = {
  backgroundColor: "#f8fafc",
  borderRadius: "8px",
  padding: "12px 16px",
};

const infoLabel: React.CSSProperties = {
  fontSize: "11px", fontWeight: 700,
  color: "#94a3b8", textTransform: "uppercase",
  letterSpacing: "0.05em", margin: "0 0 2px 0",
};

const infoValue: React.CSSProperties = {
  fontSize: "14px", color: "#1e293b",
  fontWeight: 600, margin: "0 0 8px 0",
};

const labelStyle: React.CSSProperties = {
  fontSize: "13px", fontWeight: 600,
  color: "#475569", display: "block", marginBottom: "6px",
};

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "8px 12px",
  borderRadius: "6px", border: "1px solid #e2e8f0",
  fontSize: "14px", color: "#1e293b",
  boxSizing: "border-box",
};

const cancelBtn: React.CSSProperties = {
  flex: 1, padding: "10px",
  borderRadius: "8px", border: "1px solid #e2e8f0",
  backgroundColor: "white", color: "#64748b",
  fontSize: "14px", fontWeight: 600, cursor: "pointer",
};

function submitBtn(disabled: boolean): React.CSSProperties {
  return {
    flex: 2, padding: "10px",
    borderRadius: "8px", border: "none",
    backgroundColor: disabled ? "#e2e8f0" : "#16a34a",
    color: disabled ? "#94a3b8" : "white",
    fontSize: "14px", fontWeight: 600,
    cursor: disabled ? "not-allowed" : "pointer",
  };
}