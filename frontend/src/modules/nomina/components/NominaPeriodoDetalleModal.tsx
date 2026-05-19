import { useEffect, useState } from "react";
import { abrirReciboIndividual, abrirRecibosPeriodo } from "../api/nomina.api";
import {
  useActualizarRegistro,
  useCerrarPeriodo,
  useCrearIncidencia,
  useDiferirCuota,
  useEliminarIncidencia,
  usePeriodo,
  useReabrirPeriodo,
  useSetBonoOverride,
} from "../hooks/useNomina";
import { NOMBRES_DIAS, TIPO_INCIDENCIA_LABEL, getSemanaISO, type Registro, type TipoIncidencia } from "../types/nomina";
import { useToast } from "../../../shared/hooks/useToast";


interface Props {
  periodoId: number;
  onClose: () => void;
}


export function NominaPeriodoDetalleModal({ periodoId, onClose }: Props) {
  const { data: periodo, isLoading } = usePeriodo(periodoId);
  const cerrar  = useCerrarPeriodo();
  const reabrir = useReabrirPeriodo();
  const { addToast } = useToast();
  const [confirmarCerrar, setConfirmarCerrar] = useState(false);
  const [confirmarReabrir, setConfirmarReabrir] = useState(false);

  const cerrado = periodo?.estado === "CERRADA";

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 900, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#f8fafc", borderRadius: "12px", width: "min(1200px, 95vw)", maxHeight: "92vh", overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 20px 60px rgba(0,0,0,0.22)" }}>
        <div style={{ padding: "16px 20px", background: "white", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "#0f172a" }}>
              {periodo ? `Semana ${getSemanaISO(periodo.fecha_inicio)} · ${fmtDate(periodo.fecha_inicio)} – ${fmtDate(periodo.fecha_fin)}` : "Período …"}
            </h2>
            {periodo && (
              <p style={{ margin: "3px 0 0", fontSize: "12px", color: "#64748b" }}>
                {cerrado ? "Pagada" : "Por pagar"} · {periodo.registros.length} empleados · Total {fmtMoney(periodo.total_a_pagar)}
              </p>
            )}
          </div>
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
            <button onClick={() => abrirRecibosPeriodo(periodoId)} style={btnSecondary}>📄 Recibos del período</button>
            {periodo && !cerrado && (
              <button onClick={() => setConfirmarCerrar(true)} disabled={cerrar.isPending} style={btnPrimary}>
                {cerrar.isPending ? "Marcando…" : "Marcar como pagada"}
              </button>
            )}
            {periodo && cerrado && (
              <button onClick={() => setConfirmarReabrir(true)} disabled={reabrir.isPending} style={btnPrimary}>
                {reabrir.isPending ? "Reabriendo…" : "Reabrir nómina"}
              </button>
            )}
            <button onClick={onClose} style={{ ...btnSecondary, padding: "9px 12px" }}>✕</button>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "14px 18px" }}>
          {isLoading || !periodo ? (
            <p style={{ color: "#64748b" }}>Cargando…</p>
          ) : periodo.registros.length === 0 ? (
            <p style={{ color: "#94a3b8" }}>No hay empleados en este período.</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12.5px", background: "white", border: "1px solid #e2e8f0", borderRadius: "8px", overflow: "hidden" }}>
              <thead>
                <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                  <th style={th}>Empleado</th>
                  {NOMBRES_DIAS.map(d => <th key={d} style={{ ...th, textAlign: "center", padding: "8px 4px" }}>{d}</th>)}
                  <th style={{ ...th, textAlign: "right" }}>Horas extra</th>
                  <th style={{ ...th, textAlign: "right" }}>Base</th>
                  <th style={{ ...th, textAlign: "right" }}>Monto HE</th>
                  <th style={{ ...th, textAlign: "right" }}>(+) Otros</th>
                  <th style={{ ...th, textAlign: "right" }}>(−) Desc</th>
                  <th style={{ ...th, textAlign: "right" }}>Total</th>
                  <th style={{ ...th, textAlign: "right" }}></th>
                </tr>
              </thead>
              <tbody>
                {periodo.registros.map(reg => (
                  <FilaRegistro key={reg.id} registro={reg} cerrado={cerrado} addToast={addToast} />
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {confirmarCerrar && (
        <ConfirmacionModal
          mensaje="Al marcar como pagada se congelará el sueldo aplicado y la nómina quedará bloqueada para edición. Para hacer cambios después tendrás que reabrirla. ¿Continuar?"
          onConfirm={() => cerrar.mutate(periodoId, {
            onSuccess: () => { setConfirmarCerrar(false); addToast("Nómina marcada como pagada."); },
            onError:   () => { setConfirmarCerrar(false); addToast("Error al marcar como pagada.", "error"); },
          })}
          onClose={() => setConfirmarCerrar(false)}
          loading={cerrar.isPending}
        />
      )}
      {confirmarReabrir && (
        <ConfirmacionModal
          mensaje="Reabrir vuelve la nómina a estado por pagar y permite editarla. El sueldo congelado se recalculará con el sueldo actual de cada empleado. ¿Continuar?"
          onConfirm={() => reabrir.mutate(periodoId, {
            onSuccess: () => { setConfirmarReabrir(false); addToast("Nómina reabierta."); },
            onError:   () => { setConfirmarReabrir(false); addToast("Error al reabrir la nómina.", "error"); },
          })}
          onClose={() => setConfirmarReabrir(false)}
          loading={reabrir.isPending}
        />
      )}
    </div>
  );
}


function FilaRegistro({ registro, cerrado, addToast }: { registro: Registro; cerrado: boolean; addToast: (m: string, t?: "success"|"error") => void }) {
  const actualizar = useActualizarRegistro();
  const [modoModal, setModoModal] = useState<"otros" | "desc" | null>(null);

  const dias: (keyof Registro)[] = ["dia_1","dia_2","dia_3","dia_4","dia_5","dia_6","dia_7"];

  function commitDia(campo: keyof Registro, valor: number) {
    if ((registro as unknown as Record<string, number>)[campo as string] === valor) return;
    actualizar.mutate(
      { id: registro.id, payload: { [campo]: valor } },
      { onError: () => addToast("Error al actualizar.", "error") },
    );
  }

  function commitHoras(valor: number) {
    if (registro.horas_extra === valor) return;
    actualizar.mutate(
      { id: registro.id, payload: { horas_extra: valor } },
      { onError: () => addToast("Error al actualizar.", "error") },
    );
  }

  return (
    <>
      <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
        <td style={{ ...td, fontWeight: 600 }}>
          <div>{registro.usuario_nombre}</div>
          {registro.area && <div style={{ fontSize: "10px", color: "#94a3b8" }}>{registro.area}</div>}
        </td>
        {dias.map(campo => (
          <td key={String(campo)} style={{ ...td, textAlign: "center", padding: "4px" }}>
            <SelectorAsistencia
              value={Number((registro as unknown as Record<string, number>)[campo as string])}
              disabled={cerrado}
              onChange={v => commitDia(campo, v)}
            />
          </td>
        ))}
        <td style={{ ...td, textAlign: "right", padding: "4px 8px" }}>
          <InputNumero
            value={registro.horas_extra}
            disabled={cerrado}
            onCommit={commitHoras}
          />
        </td>
        <td style={{ ...td, textAlign: "right" }}>{fmtMoney(registro.importe_base)}</td>
        <td style={{ ...td, textAlign: "right" }}>{fmtMoney(registro.monto_horas_extra)}</td>
        <td style={{ ...td, textAlign: "right", color: "#16a34a", padding: 0 }}>
          <button onClick={() => !cerrado && setModoModal("otros")} disabled={cerrado}
                  style={cellBtn(cerrado, "#16a34a")}>
            {fmtMoney(registro.percepciones_extra)}
          </button>
        </td>
        <td style={{ ...td, textAlign: "right", color: "#dc2626", padding: 0 }}>
          <button onClick={() => !cerrado && setModoModal("desc")} disabled={cerrado}
                  style={cellBtn(cerrado, "#dc2626")}>
            {fmtMoney(registro.deducciones)}
          </button>
        </td>
        <td style={{ ...td, textAlign: "right", fontWeight: 700, color: "#0f172a" }}>{fmtMoney(registro.total_a_pagar)}</td>
        <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>
          <button onClick={() => abrirReciboIndividual(registro.id)} style={btnLink}>📄 Recibo</button>
        </td>
      </tr>
      {modoModal && (
        <IncidenciasInlineModal
          registro={registro}
          modo={modoModal}
          onClose={() => setModoModal(null)}
          addToast={addToast}
        />
      )}
    </>
  );
}


function cellBtn(disabled: boolean, color: string): React.CSSProperties {
  return {
    width: "100%", padding: "8px 10px", textAlign: "right",
    background: "transparent", border: "none", color,
    fontWeight: 600, fontSize: 12.5, cursor: disabled ? "default" : "pointer",
    fontFamily: "inherit",
  };
}


function IncidenciasInlineModal({
  registro, modo, onClose, addToast,
}: {
  registro: Registro;
  modo: "otros" | "desc";
  onClose: () => void;
  addToast: (m: string, t?: "success" | "error") => void;
}) {
  const crear       = useCrearIncidencia();
  const elimina     = useEliminarIncidencia();
  const diferir     = useDiferirCuota();
  const setOverride = useSetBonoOverride();

  const esPositivo = modo === "otros";
  const titulo = esPositivo ? "(+) Percepciones" : "(−) Deducciones";
  const incidencias = registro.incidencias.filter(i =>
    i.tipo !== "HORA_EXTRA" && (esPositivo ? i.monto >= 0 : i.monto < 0),
  );
  const sumaTotal = incidencias.reduce((s, i) => s + Math.abs(i.monto), 0);

  // Tipos válidos para crear, según signo
  const tiposPos: TipoIncidencia[] = ["PERCEPCION_EXTRA", "BONO_PRODUCTIVIDAD", "OTRO"];
  // DESCUENTO_FALTA queda fuera: el descuento por faltar se aplica automáticamente
  // al reducirse los días pagables (max 6 días).
  const tiposNeg: TipoIncidencia[] = ["ADELANTO", "DESCUENTO_RETARDO", "DESCUENTO_BIEN", "OTRO"];
  const tiposValidos = esPositivo ? tiposPos : tiposNeg;
  const [tipo, setTipo]   = useState<TipoIncidencia>(tiposValidos[0]);
  const [monto, setMonto] = useState("");
  const [desc, setDesc]   = useState("");

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const valor = parseFloat(monto);
    if (!valor || valor <= 0) return;
    crear.mutate(
      {
        registro_id: registro.id,
        payload: {
          tipo,
          monto: esPositivo ? valor : -valor,
          descripcion: desc.trim() || undefined,
        },
      },
      {
        onSuccess: () => { setMonto(""); setDesc(""); addToast("Agregado."); },
        onError: () => addToast("Error al agregar.", "error"),
      },
    );
  }

  function handleDelete(id: number) {
    elimina.mutate(id, {
      onError: (err: unknown) => {
        const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Error al eliminar.";
        addToast(msg, "error");
      },
    });
  }

  function handleDiferir(id: number, diferida: boolean) {
    diferir.mutate(
      { id, diferida },
      {
        onSuccess: () => addToast(diferida ? "Cuota marcada como no pagada." : "Cuota marcada como pagada."),
        onError: (err: unknown) => {
          const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Error al actualizar la cuota.";
          addToast(msg, "error");
        },
      },
    );
  }

  function volverAutoBono() {
    setOverride.mutate(
      { id: registro.id, override: null },
      {
        onSuccess: () => addToast("Bono restaurado a automático."),
        onError: () => addToast("Error al restaurar bono.", "error"),
      },
    );
  }

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "white", borderRadius: 12, width: "min(520px, 92vw)", maxHeight: "85vh", overflowY: "auto", padding: 20, boxShadow: "0 20px 60px rgba(0,0,0,0.22)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#0f172a" }}>{titulo}</h3>
            {esPositivo && (
              <p style={{ margin: "2px 0 0", fontSize: 11, color: "#94a3b8" }}>
                {registro.usuario_nombre} · Total: {fmtMoney(sumaTotal)}
              </p>
            )}
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "#94a3b8" }}>✕</button>
        </div>

        {esPositivo && registro.bono_override === "QUITAR" && (
          <div style={{ background: "#fef3c7", border: "1px solid #fde68a", borderRadius: 7, padding: "8px 10px", fontSize: 12, color: "#92400e", marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            <span>Bono automático desactivado para este empleado.</span>
            <button onClick={volverAutoBono} disabled={setOverride.isPending} style={btnLinkSmall}>Volver a auto</button>
          </div>
        )}

        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, marginBottom: 12 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
              <th style={modalTh}>Concepto</th>
              <th style={{ ...modalTh, textAlign: "right" }}>Monto</th>
              <th style={modalTh}></th>
            </tr>
          </thead>
          <tbody>
            {incidencias.length === 0 ? (
              <tr><td colSpan={3} style={{ padding: 12, color: "#94a3b8", textAlign: "center" }}>
                Sin {esPositivo ? "percepciones" : "deducciones"} registradas.
              </td></tr>
            ) : incidencias.map(i => {
              const esCuota = i.tipo === "CUOTA_PRESTAMO";
              const tachado: React.CSSProperties = i.diferida ? { textDecoration: "line-through", opacity: 0.5 } : {};
              return (
                <tr key={i.id} style={{ borderBottom: "1px solid #f8fafc" }}>
                  <td style={{ ...modalTd }}>
                    <div style={{ fontWeight: 600, color: "#0f172a", ...tachado }}>{TIPO_INCIDENCIA_LABEL[i.tipo]}</div>
                    {i.descripcion && <div style={{ fontSize: 11, color: "#64748b", ...tachado }}>{i.descripcion}</div>}
                    <div style={{ display: "flex", gap: 4, marginTop: 2 }}>
                      {i.auto_generada && <span style={{ fontSize: 9, padding: "1px 6px", background: "#fef3c7", color: "#92400e", borderRadius: 10, fontWeight: 600 }}>auto</span>}
                      {i.diferida && <span style={{ fontSize: 9, padding: "1px 6px", background: "#f1f5f9", color: "#475569", borderRadius: 10, fontWeight: 600 }}>no pagada</span>}
                    </div>
                  </td>
                  <td style={{ ...modalTd, textAlign: "right", fontWeight: 600, color: esPositivo ? "#16a34a" : "#dc2626", ...tachado }}>
                    {fmtMoney(i.monto)}
                  </td>
                  <td style={{ ...modalTd, textAlign: "right" }}>
                    {esCuota ? (
                      <button onClick={() => handleDiferir(i.id, !i.diferida)} disabled={diferir.isPending}
                              style={i.diferida ? btnNeutralMini : btnWarnMini}>
                        {i.diferida ? "Marcar pagada" : "No pagada"}
                      </button>
                    ) : (
                      <button onClick={() => handleDelete(i.id)} style={btnDangerMini}>Eliminar</button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <form onSubmit={handleAdd} style={{ borderTop: "1px solid #e2e8f0", paddingTop: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>
            Agregar {esPositivo ? "percepción" : "deducción"}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
            <div>
              <label style={miniLabel}>Tipo</label>
              <select value={tipo} onChange={e => setTipo(e.target.value as TipoIncidencia)} style={miniInput}>
                {tiposValidos.map(t => <option key={t} value={t}>{TIPO_INCIDENCIA_LABEL[t]}</option>)}
              </select>
            </div>
            <div>
              <label style={miniLabel}>Monto</label>
              <input type="number" min="0" step="0.01" value={monto} onChange={e => setMonto(e.target.value)} placeholder="0.00" style={miniInput} />
            </div>
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={miniLabel}>Descripción (opcional)</label>
            <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Ej. bono por mes completo" style={miniInput} />
          </div>
          <button type="submit" disabled={crear.isPending || !monto} style={{ ...btnPrimary, width: "100%", padding: "9px", fontSize: 13 }}>
            {crear.isPending ? "Agregando…" : `+ Agregar ${esPositivo ? "percepción" : "deducción"}`}
          </button>
        </form>
      </div>
    </div>
  );
}


function SelectorAsistencia({ value, disabled, onChange }: { value: number; disabled?: boolean; onChange: (v: number) => void }) {
  // Ciclo: vacío → asistencia completa → medio día → vacío
  const opciones: { val: number; label: string; color: string; bg: string }[] = [
    { val: 0,   label: "✕",  color: "#94a3b8", bg: "transparent" },
    { val: 1,   label: "✓",  color: "#16a34a", bg: "#dcfce7" },
    { val: 0.5, label: "½",  color: "#d97706", bg: "#fef3c7" },
  ];
  const idx = opciones.findIndex(o => o.val === value);
  const current = opciones[idx >= 0 ? idx : 0];
  function next() {
    const i = (idx + 1) % opciones.length;
    onChange(opciones[i].val);
  }
  return (
    <button
      type="button" onClick={next} disabled={disabled}
      style={{
        width: 30, height: 28, borderRadius: 6, border: "1px solid #e2e8f0",
        background: current.bg, color: current.color, fontSize: 13, fontWeight: 700,
        cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1,
      }}
      title={`Asistencia: ${current.val}`}
    >
      {current.label}
    </button>
  );
}


function InputNumero({ value, disabled, onCommit }: { value: number; disabled?: boolean; onCommit: (v: number) => void }) {
  const [local, setLocal] = useState(String(value));
  useEffect(() => setLocal(String(value)), [value]);
  return (
    <input
      type="number" step="0.5" min="0"
      value={local} disabled={disabled}
      onChange={e => setLocal(e.target.value)}
      onBlur={() => {
        const v = parseFloat(local);
        if (!isNaN(v) && v >= 0) onCommit(v);
        else setLocal(String(value));
      }}
      style={{ width: 56, padding: "4px 6px", borderRadius: 6, border: "1px solid #e2e8f0", background: disabled ? "#f1f5f9" : "white", textAlign: "right", fontSize: 12 }}
    />
  );
}


function ConfirmacionModal({ mensaje, onConfirm, onClose, loading }: { mensaje: string; onConfirm: () => void; onClose: () => void; loading: boolean }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "white", borderRadius: "10px", padding: "20px", width: "420px", maxWidth: "92vw", boxShadow: "0 20px 60px rgba(0,0,0,0.22)" }}>
        <p style={{ margin: "0 0 16px", fontSize: "13px", color: "#334155", lineHeight: 1.5 }}>{mensaje}</p>
        <div style={{ display: "flex", gap: "8px" }}>
          <button onClick={onClose} style={{ flex: 1, padding: "8px", borderRadius: "6px", border: "1px solid #e2e8f0", background: "white", color: "#64748b", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>Cancelar</button>
          <button onClick={onConfirm} disabled={loading} style={{ flex: 1, padding: "8px", borderRadius: "6px", border: "none", background: "#2563eb", color: "white", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>
            {loading ? "…" : "Confirmar"}
          </button>
        </div>
      </div>
    </div>
  );
}


function fmtMoney(n: number): string {
  return `$${n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtDate(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}


const th: React.CSSProperties = { padding: "8px 10px", textAlign: "left", fontSize: "10.5px", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.04em" };
const td: React.CSSProperties = { padding: "8px 10px", color: "#334155" };

const btnPrimary: React.CSSProperties = { padding: "8px 14px", borderRadius: "7px", border: "none", background: "#2563eb", color: "white", fontSize: "13px", fontWeight: 600, cursor: "pointer" };
const btnSecondary: React.CSSProperties = { padding: "8px 14px", borderRadius: "7px", border: "1px solid #e2e8f0", background: "white", color: "#64748b", fontSize: "13px", fontWeight: 600, cursor: "pointer" };
const btnLink: React.CSSProperties = { background: "none", border: "none", color: "#2563eb", fontSize: "12px", fontWeight: 600, cursor: "pointer", padding: 0 };
const btnLinkSmall: React.CSSProperties = { background: "none", border: "none", color: "#92400e", fontSize: 11, fontWeight: 700, cursor: "pointer", padding: 0, textDecoration: "underline" };
const btnDangerMini: React.CSSProperties = { padding: "3px 8px", borderRadius: 5, border: "1px solid #fecaca", background: "#fef2f2", color: "#dc2626", fontSize: 10.5, fontWeight: 600, cursor: "pointer" };
const btnWarnMini: React.CSSProperties = { padding: "3px 8px", borderRadius: 5, border: "1px solid #fde68a", background: "#fef3c7", color: "#92400e", fontSize: 10.5, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" };
const btnNeutralMini: React.CSSProperties = { padding: "3px 8px", borderRadius: 5, border: "1px solid #cbd5e1", background: "white", color: "#475569", fontSize: 10.5, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" };
const modalTh: React.CSSProperties = { padding: "6px 8px", textAlign: "left", fontSize: 10.5, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.04em" };
const modalTd: React.CSSProperties = { padding: "8px", color: "#334155", verticalAlign: "top" };
const miniLabel: React.CSSProperties = { display: "block", marginBottom: 2, fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase" };
const miniInput: React.CSSProperties = { width: "100%", boxSizing: "border-box", padding: "7px 9px", borderRadius: 6, border: "1px solid #e2e8f0", fontSize: 12, background: "white" };
