import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import apiClient from "../../../core/api/apiClient";
import { useToast } from "../../../shared/hooks/useToast";
import {
  useCancelarPrestamo,
  useCrearPrestamo,
  usePrestamos,
} from "../hooks/useNomina";
import type { EstadoPrestamo, Prestamo } from "../types/nomina";

interface UsuarioLite {
  id: number;
  nombre: string;
  username: string;
  activo: boolean;
  en_nomina: boolean;
}


export function NominaPrestamosTab() {
  const [soloActivos, setSoloActivos] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [confirmarCancelar, setConfirmarCancelar] = useState<Prestamo | null>(null);

  const { data: prestamos = [], isLoading } = usePrestamos(soloActivos);
  const cancelar = useCancelarPrestamo();
  const { addToast } = useToast();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: "6px" }}>
          <FilterBtn active={soloActivos}  onClick={() => setSoloActivos(true)}>Activos</FilterBtn>
          <FilterBtn active={!soloActivos} onClick={() => setSoloActivos(false)}>Todos</FilterBtn>
        </div>
        <button onClick={() => setShowForm(true)} style={btnPrimary}>+ Nuevo préstamo</button>
      </div>

      <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: "10px", overflow: "hidden" }}>
        {isLoading ? (
          <p style={{ padding: "18px", color: "#64748b" }}>Cargando…</p>
        ) : prestamos.length === 0 ? (
          <p style={{ padding: "18px", color: "#94a3b8", fontSize: "13px" }}>No hay préstamos para mostrar.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                <th style={th}>Empleado</th>
                <th style={th}>Motivo</th>
                <th style={{ ...th, textAlign: "right" }}>Monto</th>
                <th style={{ ...th, textAlign: "right" }}>Cuota</th>
                <th style={{ ...th, textAlign: "center" }}>Avance</th>
                <th style={{ ...th, textAlign: "right" }}>Saldo</th>
                <th style={{ ...th, textAlign: "center" }}>Estado</th>
                <th style={{ ...th, textAlign: "right" }}></th>
              </tr>
            </thead>
            <tbody>
              {prestamos.map(p => (
                <tr key={p.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={td}>{p.usuario_nombre}</td>
                  <td style={{ ...td, color: "#64748b" }}>{p.motivo || "—"}</td>
                  <td style={{ ...td, textAlign: "right" }}>{fmtMoney(p.monto_total)}</td>
                  <td style={{ ...td, textAlign: "right" }}>{fmtMoney(p.cuota_semanal)}</td>
                  <td style={{ ...td, textAlign: "center" }}>
                    <BarraAvance pagadas={p.cuotas_pagadas} totales={p.cuotas_totales} />
                  </td>
                  <td style={{ ...td, textAlign: "right", fontWeight: 600 }}>{fmtMoney(p.saldo_pendiente)}</td>
                  <td style={{ ...td, textAlign: "center" }}><EstadoBadge estado={p.estado} /></td>
                  <td style={{ ...td, textAlign: "right" }}>
                    {p.estado === "ACTIVO" && (
                      <button onClick={() => setConfirmarCancelar(p)} style={btnDanger}>Cancelar</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showForm && (
        <PrestamoFormModal
          onClose={() => setShowForm(false)}
          onSuccess={() => { setShowForm(false); addToast("Préstamo creado."); }}
        />
      )}

      {confirmarCancelar && (
        <Confirmacion
          mensaje={`¿Cancelar el préstamo de ${confirmarCancelar.usuario_nombre} por ${fmtMoney(confirmarCancelar.monto_total)}? Esto NO genera reembolso, solo lo cierra.`}
          onConfirm={() => cancelar.mutate(confirmarCancelar.id, {
            onSuccess: () => { setConfirmarCancelar(null); addToast("Préstamo cancelado."); },
          })}
          onClose={() => setConfirmarCancelar(null)}
          loading={cancelar.isPending}
        />
      )}
    </div>
  );
}


function PrestamoFormModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [usuarioId, setUsuarioId]       = useState<number | "">("");
  const [montoTotal, setMontoTotal]     = useState("");
  const [cuotaSemanal, setCuotaSemanal] = useState("");
  const [cuotasTotales, setCuotasTotales] = useState("");
  const [motivo, setMotivo]             = useState("");

  const { data: usuarios = [] } = useQuery<UsuarioLite[]>({
    queryKey: ["usuarios-en-nomina"],
    queryFn: async () => (await apiClient.get("/api/v1/auth/usuarios")).data,
    select: (us: UsuarioLite[]) => us.filter(u => u.activo && u.en_nomina),
  });
  const crear = useCrearPrestamo();
  const { addToast } = useToast();

  const monto = parseFloat(montoTotal) || 0;
  const cuotas = parseInt(cuotasTotales, 10) || 0;
  const cuotaCalc = parseFloat(cuotaSemanal) || 0;
  const cuotaSugerida = cuotas > 0 ? monto / cuotas : 0;

  // Autollenar la cuota semanal con monto/cuotas. Si el usuario edita la cuota
  // manualmente después, el cambio se preserva hasta que vuelva a cambiar el
  // monto o las cuotas.
  useEffect(() => {
    if (cuotaSugerida > 0) {
      setCuotaSemanal(cuotaSugerida.toFixed(2));
    } else {
      setCuotaSemanal("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [montoTotal, cuotasTotales]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!usuarioId || monto <= 0 || cuotaCalc <= 0 || cuotas <= 0) return;
    crear.mutate(
      {
        usuario_id: Number(usuarioId),
        monto_total: monto,
        cuota_semanal: cuotaCalc,
        cuotas_totales: cuotas,
        motivo: motivo.trim() || undefined,
      },
      {
        onSuccess: () => onSuccess(),
        onError: (err: unknown) => {
          const msg = ((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail) || "Error al crear el préstamo.";
          addToast(msg, "error");
        },
      },
    );
  }

  return (
    <ModalShell title="Nuevo préstamo" onClose={onClose}>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <div>
          <label style={labelStyle}>Empleado</label>
          <select value={usuarioId} onChange={e => setUsuarioId(e.target.value ? Number(e.target.value) : "")} required style={inputStyle}>
            <option value="">— Selecciona —</option>
            {usuarios.map(u => (
              <option key={u.id} value={u.id}>{u.nombre} ({u.username})</option>
            ))}
          </select>
          {usuarios.length === 0 && (
            <p style={{ margin: "3px 0 0", fontSize: "11px", color: "#dc2626" }}>
              No hay empleados marcados como "en nómina". Edítalos desde Usuarios.
            </p>
          )}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
          <div>
            <label style={labelStyle}>Monto total</label>
            <input type="number" min="0" step="0.01" value={montoTotal} onChange={e => setMontoTotal(e.target.value)} required style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Cuotas totales</label>
            <input type="number" min="1" step="1" value={cuotasTotales} onChange={e => setCuotasTotales(e.target.value)} required style={inputStyle} />
          </div>
        </div>
        <div>
          <label style={labelStyle}>Cuota semanal</label>
          <input type="number" min="0" step="0.01" value={cuotaSemanal} onChange={e => setCuotaSemanal(e.target.value)} required style={inputStyle} />
          {cuotaSugerida > 0 && (
            <p style={{ margin: "3px 0 0", fontSize: "11px", color: "#94a3b8" }}>
              Calculada como {montoTotal} ÷ {cuotasTotales}. Puedes editarla si quieres otro valor.
            </p>
          )}
        </div>
        <div>
          <label style={labelStyle}>Motivo (opcional)</label>
          <input value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Ej. Adelanto, préstamo personal" style={inputStyle} />
        </div>
        <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
          <button type="button" onClick={onClose} style={btnSecondary}>Cancelar</button>
          <button type="submit" disabled={crear.isPending} style={{ ...btnPrimary, flex: 1 }}>
            {crear.isPending ? "Creando…" : "Crear préstamo"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}


function Confirmacion({ mensaje, onConfirm, onClose, loading }: { mensaje: string; onConfirm: () => void; onClose: () => void; loading?: boolean }) {
  return (
    <ModalShell title="¿Confirmar?" onClose={onClose}>
      <p style={{ margin: "0 0 16px", fontSize: "13px", color: "#334155" }}>{mensaje}</p>
      <div style={{ display: "flex", gap: "8px" }}>
        <button onClick={onClose} style={btnSecondary}>Cancelar</button>
        <button onClick={onConfirm} disabled={loading} style={{ ...btnDanger, flex: 1, padding: "9px" }}>
          {loading ? "Procesando…" : "Confirmar"}
        </button>
      </div>
    </ModalShell>
  );
}


function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "white", borderRadius: "12px", padding: "24px", width: "440px", maxWidth: "92vw", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <h2 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "#0f172a" }}>{title}</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: "18px", cursor: "pointer", color: "#94a3b8" }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}


function BarraAvance({ pagadas, totales }: { pagadas: number; totales: number }) {
  const pct = totales > 0 ? Math.min(100, (pagadas / totales) * 100) : 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px", justifyContent: "center" }}>
      <div style={{ width: "80px", height: "6px", background: "#e2e8f0", borderRadius: "3px", overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: "#2563eb" }} />
      </div>
      <span style={{ fontSize: "12px", color: "#64748b", fontFamily: "monospace" }}>{pagadas}/{totales}</span>
    </div>
  );
}


const ESTADO_COLORS: Record<EstadoPrestamo, { bg: string; color: string; border: string }> = {
  ACTIVO:    { bg: "#eff6ff", color: "#1d4ed8", border: "#bfdbfe" },
  PAGADO:    { bg: "#ecfdf5", color: "#047857", border: "#a7f3d0" },
  CANCELADO: { bg: "#f8fafc", color: "#64748b", border: "#e2e8f0" },
};

function EstadoBadge({ estado }: { estado: EstadoPrestamo }) {
  const c = ESTADO_COLORS[estado];
  return (
    <span style={{ padding: "2px 8px", borderRadius: "20px", fontSize: "10px", fontWeight: 600,
                   background: c.bg, color: c.color, border: `1px solid ${c.border}` }}>
      {estado}
    </span>
  );
}


function FilterBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{
      padding: "6px 14px", borderRadius: "7px", border: "1px solid",
      borderColor: active ? "#2563eb" : "#e2e8f0", background: active ? "#eff6ff" : "white",
      color: active ? "#1d4ed8" : "#64748b", fontSize: "12px", fontWeight: 600, cursor: "pointer",
    }}>{children}</button>
  );
}


function fmtMoney(n: number): string {
  return `$${n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const th: React.CSSProperties = {
  padding: "10px 12px", textAlign: "left", fontSize: "11px",
  fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.04em",
};
const td: React.CSSProperties = { padding: "10px 12px", color: "#334155" };
const labelStyle: React.CSSProperties = { display: "block", marginBottom: "4px", fontSize: "11px", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.06em" };
const inputStyle: React.CSSProperties = { width: "100%", boxSizing: "border-box", padding: "9px 11px", borderRadius: "7px", border: "1px solid #e2e8f0", fontSize: "13px", color: "#1e293b", background: "#f8fafc", outline: "none" };
const btnPrimary: React.CSSProperties = { padding: "9px 16px", borderRadius: "7px", border: "none", background: "#2563eb", color: "white", fontSize: "13px", fontWeight: 600, cursor: "pointer" };
const btnSecondary: React.CSSProperties = { flex: 1, padding: "9px", borderRadius: "7px", border: "1px solid #e2e8f0", background: "white", color: "#64748b", fontSize: "13px", fontWeight: 600, cursor: "pointer" };
const btnDanger: React.CSSProperties = { padding: "5px 10px", borderRadius: "6px", border: "1px solid #fecaca", background: "#fef2f2", color: "#dc2626", fontSize: "11px", fontWeight: 600, cursor: "pointer" };
