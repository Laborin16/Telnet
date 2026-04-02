import { useState } from "react";
import { useClients } from "./modules/clients/hooks/useClients";
import { ClientsTable } from "./modules/clients/components/ClientsTable";

export default function App() {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError } = useClients({ page });

  return (
    <div style={{ padding: "24px", fontFamily: "sans-serif" }}>
      <h1 style={{ fontSize: "22px", fontWeight: 700, marginBottom: "16px", color: "#1e293b" }}>
        Gestión de Clientes
      </h1>

      {isLoading && <p>Cargando clientes...</p>}
      {isError && <p style={{ color: "red" }}>Error al cargar los datos.</p>}

      {data && (
        <>
          <p style={{ marginBottom: "12px", color: "#64748b" }}>
            Total: {data.count} clientes
          </p>
          <ClientsTable clients={data.results} />
          <div style={{ marginTop: "16px", display: "flex", gap: "8px", alignItems: "center" }}>
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
              ← Anterior
            </button>
            <span>Página {page}</span>
            <button onClick={() => setPage((p) => p + 1)} disabled={!data.next}>
              Siguiente →
            </button>
          </div>
        </>
      )}
    </div>
  );
}