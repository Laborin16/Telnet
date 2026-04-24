import { useResumenWhatsApp, useEjecutarRecordatorios } from "../hooks/useWhatsApp";

interface Props {
  onClose: () => void;
}

const COLOR_DIA: Record<number, string> = {
  0: "#16a34a",
  1: "#d97706",
  2: "#ea580c",
  3: "#dc2626",
  4: "#dc2626",
  5: "#dc2626",
  6: "#dc2626",
  7: "#7c3aed",
};

export function WhatsAppModal({ onClose }: Props) {
  const { data: resumen, isLoading } = useResumenWhatsApp();
  const { mutate, isPending, isSuccess, data: resultado } = useEjecutarRecordatorios();

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#1e293b", margin: 0 }}>
            Enviar Recordatorios WhatsApp
          </h2>
          <button onClick={onClose} style={closeBtn}>✕</button>
        </div>

        {isLoading && <p style={{ color: "#64748b" }}>Cargando resumen...</p>}

        {resumen && !isSuccess && (
          <>
            <p style={{ fontSize: "13px", color: "#64748b", marginBottom: "16px" }}>
              Se enviarán mensajes a <strong>{resumen.total}</strong> clientes con facturas pendientes:
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "16px" }}>
              {resumen.resumen.filter(r => r.count > 0).map((r) => (
                <div key={r.dia} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 14px", borderRadius: "8px", backgroundColor: "#f8fafc", border: "1px solid #e2e8f0" }}>
                  <div>
                    <span style={{ fontSize: "13px", color: "#475569" }}>{r.label}</span>
                    {"plantilla" in r && (
                      <span style={{ marginLeft: "8px", fontSize: "11px", color: "#94a3b8", fontFamily: "monospace" }}>
                        {(r as { plantilla: string }).plantilla}
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: "14px", fontWeight: 700, color: COLOR_DIA[r.dia] ?? "#64748b" }}>
                    {r.count} cliente{r.count !== 1 ? "s" : ""}
                  </span>
                </div>
              ))}
            </div>

            {(() => {
              const suspendidos = resumen.resumen.filter(r => r.dia === 4).reduce((s, r) => s + r.count, 0);
              const recoleccion = resumen.resumen.filter(r => r.dia === 7).reduce((s, r) => s + r.count, 0);
              return (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "16px" }}>
                  {suspendidos > 0 && (
                    resumen.suspension_habilitada ? (
                      <div style={{ padding: "10px 14px", backgroundColor: "#fef2f2", borderRadius: "8px", border: "1px solid #fca5a5" }}>
                        <p style={{ fontSize: "12px", color: "#dc2626", fontWeight: 600, margin: 0 }}>
                          ⚠ {suspendidos} servicio(s) serán suspendidos automáticamente.
                        </p>
                      </div>
                    ) : (
                      <div style={{ padding: "10px 14px", backgroundColor: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                        <p style={{ fontSize: "12px", color: "#64748b", margin: 0 }}>
                          ℹ {suspendidos} cliente(s) con servicio vencido. Suspensión automática desactivada.
                        </p>
                      </div>
                    )
                  )}
                  {recoleccion > 0 && (
                    <div style={{ padding: "10px 14px", backgroundColor: "#f5f3ff", borderRadius: "8px", border: "1px solid #c4b5fd" }}>
                      <p style={{ fontSize: "12px", color: "#7c3aed", fontWeight: 600, margin: 0 }}>
                        📦 {recoleccion} cliente(s) recibirán aviso de recolección de equipo (7+ días).
                      </p>
                    </div>
                  )}
                </div>
              );
            })()}

            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={onClose} style={cancelBtn}>Cancelar</button>
              <button
                onClick={() => mutate()}
                disabled={isPending || resumen.total === 0}
                style={submitBtn(isPending || resumen.total === 0)}
              >
                {isPending ? "Enviando..." : `Confirmar envío (${resumen.total})`}
              </button>
            </div>
          </>
        )}

        {isSuccess && resultado && (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
              <Stat label="Enviados" value={resultado.enviados} color="#16a34a" />
              <Stat label="Errores" value={resultado.errores} color="#dc2626" />
              <Stat label="Suspendidos" value={resultado.suspendidos} color="#7c3aed" />
            </div>

            <div style={{ maxHeight: "260px", overflowY: "auto", border: "1px solid #e2e8f0", borderRadius: "8px" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                <thead>
                  <tr style={{ backgroundColor: "#f1f5f9" }}>
                    <th style={th}>Cliente</th>
                    <th style={th}>Día</th>
                    <th style={th}>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {resultado.detalle.map((d, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={td}>{d.nombre}</td>
                      <td style={td}>{d.dias}</td>
                      <td style={td}>
                        <span style={{ color: d.estado === "enviado" ? "#16a34a" : d.estado === "sin_telefono" ? "#d97706" : "#dc2626", fontWeight: 600 }}>
                          {d.estado === "enviado" ? "✓ Enviado" : d.estado === "sin_telefono" ? "Sin teléfono" : "✗ Error"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button onClick={onClose} style={{ ...cancelBtn, width: "100%" }}>Cerrar</button>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ flex: 1, padding: "12px 16px", backgroundColor: "#f8fafc", borderRadius: "8px", textAlign: "center" }}>
      <div style={{ fontSize: "24px", fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>{label}</div>
    </div>
  );
}

const overlay: React.CSSProperties = {
  position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.4)",
  display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
};
const modal: React.CSSProperties = {
  backgroundColor: "white", borderRadius: "12px", padding: "24px",
  width: "480px", maxWidth: "90vw", maxHeight: "90vh", overflowY: "auto",
  boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
};
const closeBtn: React.CSSProperties = {
  background: "none", border: "none", fontSize: "18px", cursor: "pointer", color: "#94a3b8",
};
const cancelBtn: React.CSSProperties = {
  flex: 1, padding: "10px", borderRadius: "8px", border: "1px solid #e2e8f0",
  backgroundColor: "white", color: "#64748b", fontSize: "14px", fontWeight: 600, cursor: "pointer",
};
function submitBtn(disabled: boolean): React.CSSProperties {
  return {
    flex: 2, padding: "10px", borderRadius: "8px", border: "none",
    backgroundColor: disabled ? "#e2e8f0" : "#25D366",
    color: disabled ? "#94a3b8" : "white",
    fontSize: "14px", fontWeight: 600, cursor: disabled ? "not-allowed" : "pointer",
  };
}
const th: React.CSSProperties = { padding: "8px 12px", fontWeight: 600, fontSize: "12px", color: "#475569", textAlign: "left" };
const td: React.CSSProperties = { padding: "8px 12px", color: "#1e293b", textAlign: "left" };