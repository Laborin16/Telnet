import { useState } from "react";
import { useGuardarEstadoEquipo, useTecnicos } from "../hooks/useCobranza";
import type { ItemRecoleccion } from "../hooks/useCobranza";

const ESTADOS_EQUIPO = [
  { value: "recuperado", label: "Todo recuperado" },
  { value: "antena_no_recuperada", label: "Antena no recuperada" },
  { value: "modem_no_recuperado", label: "Módem no recuperado" },
  { value: "nada_recuperado", label: "Nada recuperado" },
];


interface Props {
  item: ItemRecoleccion;
  onClose: () => void;
}

export function RecoleccionModal({ item, onClose }: Props) {
  const [estadoEquipo, setEstadoEquipo] = useState(item.estado_equipo ?? "nada_recuperado");
  const [notas, setNotas] = useState(item.notas ?? "");
  const [tecnicoId, setTecnicoId] = useState<number | null>(item.id_tecnico ?? null);
  const { mutate, isPending, isSuccess } = useGuardarEstadoEquipo();
  const { data: tecnicos } = useTecnicos();

  function handleGuardar() {
    const tecnico = tecnicos?.find((t) => t.id === tecnicoId) ?? null;
    mutate(
      {
        id_servicio: item.id_servicio,
        estado_equipo: estadoEquipo,
        notas: notas || undefined,
        id_tecnico: tecnicoId,
        nombre_tecnico: tecnico?.nombre ?? null,
      },
      { onSuccess: () => setTimeout(onClose, 1500) }
    );
  }

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#1e293b", margin: 0 }}>
            {item.nombre}
          </h2>
          <button onClick={onClose} style={closeBtn}>✕</button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div>
            <label style={labelStyle}>Estado del equipo</label>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {ESTADOS_EQUIPO.map((e) => (
                <label key={e.value} style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "14px", color: "#1e293b" }}>
                  <input
                    type="radio"
                    name="estado_equipo"
                    value={e.value}
                    checked={estadoEquipo === e.value}
                    onChange={() => setEstadoEquipo(e.value)}
                  />
                  {e.label}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label style={labelStyle}>Técnico asignado</label>
            <select
              value={tecnicoId ?? ""}
              onChange={(e) => setTecnicoId(e.target.value ? Number(e.target.value) : null)}
              style={inputStyle}
            >
              <option value="">Sin asignar</option>
              {(tecnicos ?? []).map((t) => (
                <option key={t.id} value={t.id}>{t.nombre}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={labelStyle}>Observaciones</label>
            <textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Observaciones del técnico..."
              rows={3}
              style={{ ...inputStyle, resize: "vertical" }}
            />
          </div>
        </div>

        {isSuccess && (
          <div style={{ marginTop: "16px", padding: "10px 14px", backgroundColor: "#f0fdf4", borderRadius: "8px", color: "#16a34a", fontSize: "13px", fontWeight: 600 }}>
            Guardado
          </div>
        )}

        <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
          <button onClick={onClose} style={cancelBtn}>Cerrar</button>
          <button
            onClick={handleGuardar}
            disabled={isPending || isSuccess}
            style={submitBtn(isPending || isSuccess)}
          >
            {isPending ? "Guardando..." : "Guardar"}
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
  width: "460px", maxWidth: "90vw", maxHeight: "90vh", overflowY: "auto",
  boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
};
const closeBtn: React.CSSProperties = {
  background: "none", border: "none", fontSize: "18px",
  cursor: "pointer", color: "#94a3b8", padding: "4px 8px",
};
const labelStyle: React.CSSProperties = {
  fontSize: "13px", fontWeight: 600, color: "#475569",
  display: "block", marginBottom: "8px",
};
const inputStyle: React.CSSProperties = {
  width: "100%", padding: "8px 12px", borderRadius: "6px",
  border: "1px solid #e2e8f0", fontSize: "14px", color: "#1e293b",
  boxSizing: "border-box",
};
const cancelBtn: React.CSSProperties = {
  flex: 1, padding: "10px", borderRadius: "8px",
  border: "1px solid #e2e8f0", backgroundColor: "white",
  color: "#64748b", fontSize: "14px", fontWeight: 600, cursor: "pointer",
};
function submitBtn(disabled: boolean): React.CSSProperties {
  return {
    flex: 2, padding: "10px", borderRadius: "8px", border: "none",
    backgroundColor: disabled ? "#e2e8f0" : "#7c3aed",
    color: disabled ? "#94a3b8" : "white",
    fontSize: "14px", fontWeight: 600,
    cursor: disabled ? "not-allowed" : "pointer",
  };
}