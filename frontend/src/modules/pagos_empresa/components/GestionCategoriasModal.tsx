import { useState } from "react";
import { useActualizarCategoria, useCategorias, useCrearCategoria, useEliminarCategoria } from "../hooks/usePagosEmpresa";
import { useToast } from "../../../shared/hooks/useToast";


interface Props {
  onClose: () => void;
}


export function GestionCategoriasModal({ onClose }: Props) {
  const { data: categorias = [] } = useCategorias(true);   // incluye inactivas
  const crear = useCrearCategoria();
  const actualizar = useActualizarCategoria();
  const eliminar = useEliminarCategoria();
  const { addToast } = useToast();

  const [nuevoNombre, setNuevoNombre] = useState("");
  const [editandoId, setEditandoId]   = useState<number | null>(null);
  const [nombreEdit, setNombreEdit]   = useState("");

  const activas = categorias.filter(c => c.activa);
  const inactivas = categorias.filter(c => !c.activa);

  function handleCrear(e: React.FormEvent) {
    e.preventDefault();
    if (!nuevoNombre.trim()) return;
    crear.mutate(
      { nombre: nuevoNombre.trim(), orden: activas.length },
      {
        onSuccess: () => { setNuevoNombre(""); addToast("Categoría creada."); },
        onError: (err: unknown) => {
          const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Error al crear.";
          addToast(msg, "error");
        },
      },
    );
  }

  function handleGuardarRename(id: number) {
    if (!nombreEdit.trim()) return;
    actualizar.mutate(
      { id, payload: { nombre: nombreEdit.trim() } },
      {
        onSuccess: () => { setEditandoId(null); addToast("Categoría renombrada."); },
        onError: (err: unknown) => {
          const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Error al renombrar.";
          addToast(msg, "error");
        },
      },
    );
  }

  function handleArchivar(id: number) {
    actualizar.mutate(
      { id, payload: { activa: false } },
      {
        onSuccess: () => addToast("Categoría archivada."),
        onError: () => addToast("Error al archivar.", "error"),
      },
    );
  }

  function handleReactivar(id: number) {
    actualizar.mutate(
      { id, payload: { activa: true } },
      {
        onSuccess: () => addToast("Categoría reactivada."),
        onError: () => addToast("Error al reactivar.", "error"),
      },
    );
  }

  function handleEliminarHard(id: number, nombre: string) {
    if (!confirm(`¿Eliminar permanentemente la categoría "${nombre}"?\n(Solo posible si no tiene pagos asociados)`)) return;
    eliminar.mutate(id, {
      onSuccess: () => addToast("Categoría eliminada."),
      onError: (err: unknown) => {
        const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Error al eliminar.";
        addToast(msg, "error");
      },
    });
  }

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "white", borderRadius: 12, padding: 24, width: 480, maxWidth: "92vw", maxHeight: "92vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#0f172a" }}>Gestionar categorías</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "#94a3b8" }}>✕</button>
        </div>

        <form onSubmit={handleCrear} style={{ display: "flex", gap: 6, marginBottom: 18 }}>
          <input value={nuevoNombre} onChange={e => setNuevoNombre(e.target.value)} placeholder="Nueva categoría (ej. Servicios)"
                 maxLength={100} style={{ ...inp, flex: 1 }} />
          <button type="submit" disabled={!nuevoNombre.trim() || crear.isPending} style={btnPrimary}>
            {crear.isPending ? "…" : "Agregar"}
          </button>
        </form>

        {activas.length === 0 ? (
          <p style={{ color: "#94a3b8", fontSize: 13, marginBottom: 18 }}>No hay categorías activas. Crea la primera arriba.</p>
        ) : (
          <div style={{ marginBottom: 18 }}>
            <p style={section}>Activas</p>
            <ul style={lista}>
              {activas.map(c => (
                <li key={c.id} style={item}>
                  {editandoId === c.id ? (
                    <>
                      <input value={nombreEdit} onChange={e => setNombreEdit(e.target.value)} autoFocus
                             style={{ ...inp, flex: 1 }} />
                      <button onClick={() => handleGuardarRename(c.id)} disabled={actualizar.isPending} style={btnSuccessMini}>Guardar</button>
                      <button onClick={() => setEditandoId(null)} style={btnSecondaryMini}>Cancelar</button>
                    </>
                  ) : (
                    <>
                      <span style={{ flex: 1, fontWeight: 600, color: "#0f172a" }}>{c.nombre}</span>
                      <button onClick={() => { setEditandoId(c.id); setNombreEdit(c.nombre); }} style={btnSecondaryMini}>Renombrar</button>
                      <button onClick={() => handleArchivar(c.id)} style={btnWarnMini}>Archivar</button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {inactivas.length > 0 && (
          <div>
            <p style={section}>Archivadas</p>
            <ul style={lista}>
              {inactivas.map(c => (
                <li key={c.id} style={{ ...item, opacity: 0.6 }}>
                  <span style={{ flex: 1, fontWeight: 600, color: "#0f172a", textDecoration: "line-through" }}>{c.nombre}</span>
                  <button onClick={() => handleReactivar(c.id)} style={btnSuccessMini}>Reactivar</button>
                  <button onClick={() => handleEliminarHard(c.id, c.nombre)} style={btnDangerMini}>Eliminar</button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}


const inp: React.CSSProperties = { boxSizing: "border-box", padding: "8px 11px", borderRadius: 7, border: "1px solid #e2e8f0", fontSize: 13, color: "#1e293b", background: "#f8fafc", outline: "none" };
const section: React.CSSProperties = { margin: "0 0 6px", fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.04em" };
const lista: React.CSSProperties = { listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 6 };
const item: React.CSSProperties = { display: "flex", alignItems: "center", gap: 6, padding: "8px 10px", borderRadius: 7, background: "#f8fafc", border: "1px solid #e2e8f0" };
const btnPrimary: React.CSSProperties = { padding: "8px 14px", borderRadius: 7, border: "none", background: "#2563eb", color: "white", fontSize: 13, fontWeight: 600, cursor: "pointer" };
const btnSecondaryMini: React.CSSProperties = { padding: "4px 10px", borderRadius: 6, border: "1px solid #e2e8f0", background: "white", color: "#475569", fontSize: 11, fontWeight: 600, cursor: "pointer" };
const btnSuccessMini: React.CSSProperties = { padding: "4px 10px", borderRadius: 6, border: "none", background: "#16a34a", color: "white", fontSize: 11, fontWeight: 600, cursor: "pointer" };
const btnWarnMini: React.CSSProperties = { padding: "4px 10px", borderRadius: 6, border: "1px solid #fde68a", background: "#fef3c7", color: "#92400e", fontSize: 11, fontWeight: 600, cursor: "pointer" };
const btnDangerMini: React.CSSProperties = { padding: "4px 10px", borderRadius: 6, border: "1px solid #fecaca", background: "#fef2f2", color: "#dc2626", fontSize: 11, fontWeight: 600, cursor: "pointer" };
