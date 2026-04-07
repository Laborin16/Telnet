import type { ClientDetail } from "../../../core/types/client";
import { ClientStatusBadge } from "./ClientStatusBadge";
import { AlertaCorteCell } from "./AlertaCorteCell";
import { useClientActions } from "../hooks/useClientActions";

interface Props {
  detail: ClientDetail | undefined;
  isLoading: boolean;
  onClose: () => void;
}

export function ClientDetailModal({ detail, isLoading, onClose }: Props) {
  const { suspend, activate } = useClientActions();

  const handleSuspend = () => {
    if (!detail) return;
    if (confirm(`¿Suspender el servicio de ${detail.usuario_rb}?`)) {
      suspend.mutate(detail.id_servicio, { onSuccess: onClose });
    }
  };

  const handleActivate = () => {
    if (!detail) return;
    if (confirm(`¿Activar el servicio de ${detail.usuario_rb}?`)) {
      activate.mutate(detail.id_servicio, { onSuccess: onClose });
    }
  };

  const isBusy = suspend.isPending || activate.isPending;

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#1e293b", margin: 0 }}>
            Detalle del Cliente
          </h2>
          <button onClick={onClose} style={closeBtn}>✕</button>
        </div>

        {isLoading && <p style={{ color: "#64748b" }}>Cargando...</p>}

        {detail && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

            {detail.estado === "Activo" && (
              <button
                onClick={handleSuspend}
                disabled={isBusy}
                style={actionBtn("#dc2626", isBusy)}
              >
                {suspend.isPending ? "Suspendiendo..." : "⏸ Suspender Servicio"}
              </button>
            )}

            {detail.estado === "Suspendido" && (
              <button
                onClick={handleActivate}
                disabled={isBusy}
                style={actionBtn("#16a34a", isBusy)}
              >
                {activate.isPending ? "Activando..." : "▶ Activar Servicio"}
              </button>
            )}

            <div style={section}>
              <p style={sectionTitle}>Información General</p>
              <Row label="ID Servicio" value={String(detail.id_servicio)} />
              <Row label="Nombre" value={detail.usuario_rb} />
              <Row label="Estado" value={<ClientStatusBadge estado={detail.estado} />} />
              <Row label="Facturas" value={detail.facturas_pagadas ? "✅ Pagadas" : "⚠ Pendiente"} />
            </div>

            <div style={section}>
              <p style={sectionTitle}>Red</p>
              <Row label="IP Asignada" value={detail.ip || "—"} />
              <Row label="MAC CPE" value={detail.mac_cpe || "—"} />
              <Row label="IP Router WiFi" value={detail.ip_router_wifi || "—"} />
              <Row label="SSID" value={detail.ssid_router_wifi || "—"} />
              <Row label="Firewall" value={detail.firewall ? "Activo" : "Inactivo"} />
            </div>

            <div style={section}>
              <p style={sectionTitle}>Servicio</p>
              <Row label="Plan" value={detail.plan_internet?.nombre || "—"} />
              <Row label="Zona" value={detail.zona?.nombre || "—"} />
              <Row label="Router" value={detail.router?.nombre || "—"} />
              <Row label="Técnico" value={detail.tecnico?.nombre || "—"} />
            </div>

            <div style={section}>
              <p style={sectionTitle}>Fechas</p>
              <Row label="Corte" value={<AlertaCorteCell dias={detail.dias_para_corte} alerta={detail.alerta_corte} />} />
              <Row label="Registro" value={formatDate(detail.fecha_registro)} />
              <Row label="Instalación" value={formatDate(detail.fecha_instalacion)} />
              <Row label="Cancelación" value={formatDate(detail.fecha_cancelacion)} />
            </div>

            {detail.comentarios && (
              <div style={section}>
                <p style={sectionTitle}>Comentarios</p>
                <p style={{ fontSize: "13px", color: "#475569", margin: 0 }}>{detail.comentarios}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #f1f5f9" }}>
      <span style={{ fontSize: "13px", color: "#64748b", fontWeight: 500 }}>{label}</span>
      <span style={{ fontSize: "13px", color: "#1e293b" }}>{value}</span>
    </div>
  );
}

function formatDate(date: string | null): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("es-MX", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
  });
}

function actionBtn(color: string, disabled: boolean): React.CSSProperties {
  return {
    padding: "10px 16px",
    borderRadius: "8px",
    border: "none",
    backgroundColor: disabled ? "#e2e8f0" : color,
    color: disabled ? "#94a3b8" : "white",
    fontSize: "14px",
    fontWeight: 600,
    cursor: disabled ? "not-allowed" : "pointer",
    width: "100%",
  };
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
  width: "520px",
  maxWidth: "90vw",
  maxHeight: "85vh",
  overflowY: "auto",
  boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
};

const closeBtn: React.CSSProperties = {
  background: "none", border: "none",
  fontSize: "18px", cursor: "pointer",
  color: "#94a3b8", padding: "4px 8px",
};

const section: React.CSSProperties = {
  backgroundColor: "#f8fafc",
  borderRadius: "8px",
  padding: "12px 16px",
};

const sectionTitle: React.CSSProperties = {
  fontSize: "11px", fontWeight: 700,
  color: "#94a3b8", textTransform: "uppercase",
  letterSpacing: "0.05em", margin: "0 0 8px 0",
};