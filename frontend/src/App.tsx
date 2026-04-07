import { useState, useMemo } from "react";
import { useAllClients } from "./modules/clients/hooks/useAllClients";
import { ClientsTable } from "./modules/clients/components/ClientsTable";
import { useDebounce } from "./shared/hooks/useDebounce";
import { useClientDetail } from "./modules/clients/hooks/useClientDetail";
import { ClientDetailModal } from "./modules/clients/components/ClientDetailModal";
import { DashboardPage } from "./modules/dashboard/pages/DashboardPage";
import { FinanzasPage } from "./modules/finanzas/pages/FinanzasPage";

type Tab = "clientes" | "dashboard" | "finanzas";

const PAGE_SIZE = 25;

export default function App() {
  const [tab, setTab] = useState<Tab>("clientes");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [alerta, setAlerta] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const debouncedSearch = useDebounce(search, 200);
  const { data: allClients, isLoading, isError } = useAllClients();
  const { data: detail, isLoading: detailLoading } = useClientDetail(selectedId);

  function handleSearch(value: string) {
    setSearch(value);
    setPage(1);
  }

  function handleStatus(value: string) {
    setStatus(value);
    setPage(1);
  }

  const ALERTA_ORDER: Record<string, number> = { critico: 0, pendiente: 1, suspendido: 2, normal: 3 };

  const filtered = useMemo(() => {
    if (!allClients) return [];
    return allClients
      .filter((c) => {
        const matchStatus = !status || c.estado === status;
        const matchAlerta = !alerta || c.alerta_corte === alerta;
        const matchSearch = !debouncedSearch ||
          c.nombre.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
          String(c.id_servicio).includes(debouncedSearch);
        return matchStatus && matchAlerta && matchSearch;
      })
      .sort((a, b) => {
        const oa = a.alerta_corte != null ? ALERTA_ORDER[a.alerta_corte] : 4;
        const ob = b.alerta_corte != null ? ALERTA_ORDER[b.alerta_corte] : 4;
        if (oa !== ob) return oa - ob;
        return (a.dias_para_corte ?? 999) - (b.dias_para_corte ?? 999);
      });
  }, [allClients, status, alerta, debouncedSearch]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const start = (page - 1) * PAGE_SIZE;
  const pageItems = filtered.slice(start, start + PAGE_SIZE);

  return (
    <div style={{ padding: "24px", fontFamily: "sans-serif" }}>
      <h1 style={{ fontSize: "22px", fontWeight: 700, marginBottom: "20px", color: "#1e293b" }}>
        WISP Manager
      </h1>

      {/* Tab navigation */}
      <div style={{ display: "flex", borderBottom: "1px solid #e2e8f0", marginBottom: "24px", gap: "4px" }}>
        {([
          { key: "clientes", label: "Clientes" },
          { key: "dashboard", label: "Dashboard" },
          { key: "finanzas", label: "Finanzas" },
        ] as { key: Tab; label: string }[]).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{
              padding: "8px 18px",
              border: "none",
              borderBottom: tab === key ? "2px solid #1e40af" : "2px solid transparent",
              background: "none",
              fontSize: "14px",
              fontWeight: tab === key ? 600 : 400,
              color: tab === key ? "#1e40af" : "#64748b",
              cursor: "pointer",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "dashboard" && <DashboardPage />}
      {tab === "finanzas" && <FinanzasPage />}

      {tab === "clientes" && (
        <>
          <div style={{ display: "flex", gap: "12px", marginBottom: "12px", flexWrap: "wrap" }}>
            <input
              type="text"
              placeholder="Buscar por nombre o ID..."
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              style={inputStyle}
            />
            <select
              value={status}
              onChange={(e) => handleStatus(e.target.value)}
              style={inputStyle}
            >
              <option value="">Todos los estados</option>
              <option value="Activo">Activo</option>
              <option value="Suspendido">Suspendido</option>
              <option value="Cancelado">Cancelado</option>
            </select>
          </div>

          <div style={{ display: "flex", gap: "8px", marginBottom: "16px", flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: "12px", color: "#94a3b8", fontWeight: 600 }}>Alerta:</span>
            {[
              { key: "", label: "Todos", color: "#64748b" },
              { key: "critico", label: "Crítico", color: "#dc2626" },
              { key: "pendiente", label: "Pendiente de Pago", color: "#d97706" },
              { key: "suspendido", label: "Suspendido", color: "#64748b" },
              { key: "normal", label: "Normal", color: "#16a34a" },
            ].map(({ key, label, color }) => (
              <button
                key={key}
                onClick={() => { setAlerta(key); setPage(1); }}
                style={{
                  padding: "4px 12px",
                  borderRadius: "20px",
                  border: `1px solid ${alerta === key ? color : "#e2e8f0"}`,
                  backgroundColor: alerta === key ? color : "white",
                  color: alerta === key ? "white" : "#475569",
                  fontSize: "12px",
                  fontWeight: alerta === key ? 600 : 400,
                  cursor: "pointer",
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {isLoading && <p style={{ color: "#64748b" }}>Cargando clientes...</p>}
          {isError && <p style={{ color: "#dc2626" }}>Error al cargar los datos.</p>}

          {allClients && (
            <>
              <p style={{ marginBottom: "12px", color: "#64748b", fontSize: "14px" }}>
                {filtered.length} clientes — Página {page} de {totalPages}
              </p>

              <ClientsTable clients={pageItems} onSelect={(id) => setSelectedId(id)} />

              <div style={{ marginTop: "16px", display: "flex", gap: "8px", alignItems: "center" }}>
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  style={btnStyle(page === 1)}
                >
                  ← Anterior
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
                  .reduce<(number | "...")[]>((acc, p, idx, arr) => {
                    if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push("...");
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((p, idx) =>
                    p === "..." ? (
                      <span key={`ellipsis-${idx}`} style={{ color: "#94a3b8" }}>...</span>
                    ) : (
                      <button
                        key={p}
                        onClick={() => setPage(p as number)}
                        style={btnStyle(false, p === page)}
                      >
                        {p}
                      </button>
                    )
                  )}

                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  style={btnStyle(page === totalPages)}
                >
                  Siguiente →
                </button>
              </div>
            </>
          )}

          {selectedId !== null && (
            <ClientDetailModal
              detail={detail}
              isLoading={detailLoading}
              onClose={() => setSelectedId(null)}
            />
          )}
        </>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: "6px",
  border: "1px solid #e2e8f0",
  fontSize: "14px",
  color: "#1e293b",
  outline: "none",
  minWidth: "200px",
};

function btnStyle(disabled: boolean, active = false): React.CSSProperties {
  return {
    padding: "6px 12px",
    borderRadius: "6px",
    border: "1px solid",
    borderColor: active ? "#1e40af" : "#e2e8f0",
    backgroundColor: active ? "#1e40af" : disabled ? "#f8fafc" : "white",
    color: active ? "white" : disabled ? "#94a3b8" : "#1e293b",
    cursor: disabled ? "not-allowed" : "pointer",
    fontSize: "13px",
    fontWeight: active ? 600 : 400,
  };
}