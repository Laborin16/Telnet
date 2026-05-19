import { useEffect, useState } from "react";
import { useCategorias } from "../hooks/usePagosEmpresa";
import { GestionCategoriasModal } from "../components/GestionCategoriasModal";
import { PagosTabla } from "../components/PagosTabla";


export function PagosEmpresaPage() {
  const { data: categorias = [], isLoading } = useCategorias(false);
  const [subTab, setSubTab]     = useState<string | null>(null);
  const [showGestion, setShow]  = useState(false);

  useEffect(() => {
    if (categorias.length > 0 && (subTab === null || (subTab !== "archivadas" && !categorias.find(c => String(c.id) === subTab)))) {
      setSubTab(String(categorias[0].id));
    }
    if (categorias.length === 0 && subTab !== "archivadas") {
      setSubTab(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categorias]);

  const seleccionada = categorias.find(c => String(c.id) === subTab);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "16px 20px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#0f172a" }}>Pagos por hacer</h1>
        <button onClick={() => setShow(true)} style={btnSecondary}>⚙ Gestionar categorías</button>
      </div>

      {isLoading ? (
        <p style={{ color: "#64748b" }}>Cargando…</p>
      ) : categorias.length === 0 && subTab !== "archivadas" ? (
        <div style={{ background: "white", border: "1px dashed #cbd5e1", borderRadius: 10, padding: "32px 20px", textAlign: "center", color: "#64748b" }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#0f172a" }}>No hay categorías activas</p>
          <p style={{ margin: "6px 0 16px", fontSize: 12 }}>
            Para empezar, crea una categoría (ej. "Servicios", "Renta", "Internet") y luego registra los pagos dentro.
          </p>
          <button onClick={() => setShow(true)} style={btnPrimary}>+ Crear categoría</button>
        </div>
      ) : (
        <>
          <div style={{ display: "flex", gap: 4, background: "#f1f5f9", padding: 3, borderRadius: 8, flexWrap: "wrap" }}>
            {categorias.map(c => (
              <SubBtn key={c.id} active={subTab === String(c.id)} onClick={() => setSubTab(String(c.id))}>
                {c.nombre}
              </SubBtn>
            ))}
            <SubBtn active={subTab === "archivadas"} onClick={() => setSubTab("archivadas")}>
              Archivadas
            </SubBtn>
          </div>

          {seleccionada && subTab !== "archivadas" && (
            <PagosTabla key={seleccionada.id} categoriaId={seleccionada.id} />
          )}
          {subTab === "archivadas" && (
            <PagosTabla archivadas />
          )}
        </>
      )}

      {showGestion && <GestionCategoriasModal onClose={() => setShow(false)} />}
    </div>
  );
}


function SubBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{
      padding: "7px 14px", borderRadius: 6, border: "none",
      background: active ? "white" : "transparent",
      color: active ? "#1d4ed8" : "#64748b",
      fontSize: 13, fontWeight: 600, cursor: "pointer",
      boxShadow: active ? "0 1px 3px rgba(0,0,0,0.06)" : "none",
    }}>{children}</button>
  );
}


const btnPrimary: React.CSSProperties = { padding: "9px 16px", borderRadius: 7, border: "none", background: "#2563eb", color: "white", fontSize: 13, fontWeight: 600, cursor: "pointer" };
const btnSecondary: React.CSSProperties = { padding: "9px 14px", borderRadius: 7, border: "1px solid #e2e8f0", background: "white", color: "#475569", fontSize: 13, fontWeight: 600, cursor: "pointer" };
