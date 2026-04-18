import { useState } from "react";
import { useRegistrarPagoWispHub, useSubirComprobante } from "../hooks/useCobranza";
import type { ClienteAlerta } from "../hooks/useCobranza";
import { useEnviarWhatsAppIndividual } from "../hooks/useWhatsApp";

const today = new Date().toISOString().split("T")[0];

type TipoPago = "Efectivo" | "Transferencia" | "Depósito";

const FORMA_PAGO_ID: Record<TipoPago, number> = {
  Efectivo:      82219,
  Transferencia: 82222,
  Depósito:      82222,
};

const CUENTAS: Partial<Record<TipoPago, string[]>> = {
  Transferencia: ["BBVA Eduardo", "Compartamos Eduardo", "Spin Rebeca", "Spin Silvia"],
  Depósito:      ["Spin Rebeca", "Spin Silvia"],
};

interface Props {
  cliente: ClienteAlerta & { id_factura: number; total: number };
  onClose: () => void;
}

export function PagoModal({ cliente, onClose }: Props) {
  const [monto, setMonto] = useState<string>(String(cliente.total));
  const [tipoPago, setTipoPago] = useState<TipoPago>("Efectivo");
  const [cuenta, setCuenta] = useState<string>("");
  const [fechaPagoReal, setFechaPagoReal] = useState<string>(today);
  const [archivo, setArchivo] = useState<File | null>(null);

  const cuentasDisponibles = CUENTAS[tipoPago] ?? [];
  const cuentaSeleccionada = cuentasDisponibles.length > 0
    ? (cuenta || cuentasDisponibles[0])
    : "";

  function handleTipoPagoChange(nuevo: TipoPago) {
    setTipoPago(nuevo);
    setCuenta("");
  }

  const { mutate: registrar, isPending, isSuccess, error } = useRegistrarPagoWispHub();
  const errorMsg = error ? ((error as { response?: { data?: { detail?: string } } }).response?.data?.detail ?? "Error al registrar el pago. Intenta de nuevo.") : null;
  const { mutate: subirComprobante, isPending: subiendo } = useSubirComprobante();

  const { mutate: enviarWA, isPending: waPending, isSuccess: waSuccess, error: waError } = useEnviarWhatsAppIndividual();
  const waErrorMsg = waError
    ? ((waError as { response?: { data?: { detail?: unknown } } }).response?.data?.detail
        ? JSON.stringify((waError as { response: { data: { detail: unknown } } }).response.data.detail)
        : waError.message)
    : null;

  function handleSubmit() {
    const montoNum = parseFloat(monto);
    if (!montoNum || montoNum <= 0) return;
    registrar(
      {
        id_factura: cliente.id_factura,
        monto: montoNum,
        forma_pago: FORMA_PAGO_ID[tipoPago],
        tipo_pago: tipoPago,
        cuenta: cuentaSeleccionada || undefined,
        id_servicio: cliente.id_servicio,
        nombre_cliente: cliente.nombre,
        fecha_pago_real: fechaPagoReal,
      },
      {
        onSuccess: (data) => {
          const id = (data as { pago_id?: number }).pago_id ?? null;
          if (archivo && id) {
            subirComprobante(
              { pago_id: id, file: archivo },
              { onSuccess: () => setTimeout(onClose, 1200) }
            );
          } else {
            setTimeout(onClose, 1500);
          }
        },
      }
    );
  }

  const fechaRegistro = new Date().toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

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

        <div style={{ marginTop: "12px" }}>
          {cliente.telefono ? (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", backgroundColor: "#f0fdf4", borderRadius: "8px", border: "1px solid #bbf7d0" }}>
              <div>
                <p style={{ fontSize: "11px", fontWeight: 700, color: "#16a34a", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 2px 0" }}>Recordatorio WhatsApp</p>
                <p style={{ fontSize: "13px", color: "#475569", margin: 0 }}>{cliente.telefono}</p>
              </div>
              <button
                onClick={() => enviarWA({ phone: cliente.telefono!, nombre: cliente.nombre, monto: parseFloat(monto) || cliente.total, dias_vencido: cliente.dias_vencido })}
                disabled={waPending || waSuccess}
                style={{
                  padding: "6px 14px", borderRadius: "6px", border: "none", fontSize: "13px", fontWeight: 600,
                  cursor: waPending || waSuccess ? "default" : "pointer",
                  backgroundColor: waSuccess ? "#dcfce7" : waError ? "#fee2e2" : "#25D366",
                  color: waSuccess ? "#16a34a" : waError ? "#dc2626" : "white",
                }}
              >
                {waPending ? "Enviando..." : waSuccess ? "✓ Enviado" : waError ? "✕ Error" : "Enviar WA"}
              </button>
            </div>
          ) : (
            <div style={{ padding: "10px 14px", backgroundColor: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
              <p style={{ fontSize: "12px", color: "#94a3b8", margin: 0 }}>Sin número de teléfono — no se puede enviar WhatsApp</p>
            </div>
          )}
          {waErrorMsg && (
            <p style={{ margin: "6px 0 0 0", fontSize: "12px", color: "#dc2626", padding: "0 4px" }}>{waErrorMsg}</p>
          )}
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

          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div>
              <label style={labelStyle}>Forma de pago</label>
              <div style={{ display: "flex", gap: "8px" }}>
                {(["Efectivo", "Transferencia", "Depósito"] as TipoPago[]).map((op) => (
                  <button
                    key={op}
                    type="button"
                    onClick={() => handleTipoPagoChange(op)}
                    style={{
                      flex: 1, padding: "8px 6px", borderRadius: "6px", fontSize: "13px",
                      fontWeight: tipoPago === op ? 700 : 400, cursor: "pointer",
                      border: tipoPago === op ? "2px solid #2563eb" : "1px solid #e2e8f0",
                      background: tipoPago === op ? "#eff6ff" : "white",
                      color: tipoPago === op ? "#1d4ed8" : "#475569",
                    }}
                  >
                    {op}
                  </button>
                ))}
              </div>
            </div>

            {cuentasDisponibles.length > 0 && (
              <div>
                <label style={labelStyle}>Cuenta</label>
                <select
                  value={cuentaSeleccionada}
                  onChange={(e) => setCuenta(e.target.value)}
                  style={inputStyle}
                >
                  {cuentasDisponibles.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: "160px" }}>
              <label style={labelStyle}>Fecha de pago</label>
              <input
                type="date"
                value={fechaPagoReal}
                max={today}
                onChange={(e) => setFechaPagoReal(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div style={{ flex: 1, minWidth: "160px" }}>
              <label style={labelStyle}>Fecha de registro</label>
              <input type="text" value={fechaRegistro} readOnly style={{ ...inputStyle, backgroundColor: "#f8fafc", color: "#94a3b8", cursor: "default" }} />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Comprobante de pago <span style={{ fontWeight: 400, color: "#94a3b8" }}>(opcional)</span></label>
            <label style={fileLabel}>
              <input
                type="file"
                accept="image/*,.pdf"
                style={{ display: "none" }}
                onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
              />
              {archivo
                ? <span style={{ color: "#1e40af", fontWeight: 600 }}>{archivo.name}</span>
                : <span style={{ color: "#94a3b8" }}>Seleccionar imagen o PDF...</span>
              }
            </label>
          </div>
        </div>

        {isSuccess && !subiendo && (
          <div style={{ marginTop: "16px", padding: "10px 14px", backgroundColor: "#f0fdf4", borderRadius: "8px", color: "#16a34a", fontSize: "13px", fontWeight: 600 }}>
            ✅ Pago registrado correctamente
          </div>
        )}
        {(isPending || subiendo) && (
          <div style={{ marginTop: "16px", padding: "10px 14px", backgroundColor: "#eff6ff", borderRadius: "8px", color: "#1e40af", fontSize: "13px" }}>
            {subiendo ? "Subiendo comprobante..." : "Registrando pago..."}
          </div>
        )}
        {errorMsg && (
          <div style={{ marginTop: "16px", padding: "10px 14px", backgroundColor: "#fef2f2", borderRadius: "8px", color: "#dc2626", fontSize: "13px" }}>
            {errorMsg}
          </div>
        )}

        <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
          <button onClick={onClose} style={cancelBtn}>Cancelar</button>
          <button
            onClick={handleSubmit}
            disabled={isPending || subiendo || isSuccess}
            style={submitBtn(isPending || subiendo || isSuccess)}
          >
            {isPending ? "Registrando..." : subiendo ? "Subiendo..." : "Confirmar Pago"}
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
  backgroundColor: "white", borderRadius: "12px", padding: "24px",
  width: "460px", maxWidth: "95vw", maxHeight: "90vh", overflowY: "auto",
  boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
};
const closeBtn: React.CSSProperties = { background: "none", border: "none", fontSize: "18px", cursor: "pointer", color: "#94a3b8", padding: "4px 8px" };
const infoBox: React.CSSProperties = { backgroundColor: "#f8fafc", borderRadius: "8px", padding: "12px 16px" };
const infoLabel: React.CSSProperties = { fontSize: "11px", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 2px 0" };
const infoValue: React.CSSProperties = { fontSize: "14px", color: "#1e293b", fontWeight: 600, margin: "0 0 8px 0" };
const labelStyle: React.CSSProperties = { fontSize: "13px", fontWeight: 600, color: "#475569", display: "block", marginBottom: "6px" };
const inputStyle: React.CSSProperties = { width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #e2e8f0", fontSize: "14px", color: "#1e293b", boxSizing: "border-box" };
const fileLabel: React.CSSProperties = { display: "flex", alignItems: "center", padding: "8px 12px", borderRadius: "6px", border: "1px dashed #cbd5e1", backgroundColor: "#f8fafc", cursor: "pointer", fontSize: "13px" };
const cancelBtn: React.CSSProperties = { flex: 1, padding: "10px", borderRadius: "8px", border: "1px solid #e2e8f0", backgroundColor: "white", color: "#64748b", fontSize: "14px", fontWeight: 600, cursor: "pointer" };
function submitBtn(disabled: boolean): React.CSSProperties {
  return { flex: 2, padding: "10px", borderRadius: "8px", border: "none", backgroundColor: disabled ? "#e2e8f0" : "#16a34a", color: disabled ? "#94a3b8" : "white", fontSize: "14px", fontWeight: 600, cursor: disabled ? "not-allowed" : "pointer" };
}
