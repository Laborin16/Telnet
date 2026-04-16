import { useState } from "react";
import { useDebounce } from "../../../shared/hooks/useDebounce";
import { useAuditLogs, useAuditUsuarios, type AuditLogEntry } from "../hooks/useAuditLog";

const PAGE_SIZE = 50;

const ACCION_COLORS: Record<string, { bg: string; color: string }> = {
  CREAR:                   { bg: "#dcfce7", color: "#16a34a" },
  ACTUALIZAR:              { bg: "#dbeafe", color: "#1d4ed8" },
  ELIMINAR:                { bg: "#fee2e2", color: "#dc2626" },
  SUSPENDER:               { bg: "#ffedd5", color: "#c2410c" },
  ACTIVAR:                 { bg: "#dcfce7", color: "#15803d" },
  VERIFICAR:               { bg: "#ede9fe", color: "#6d28d9" },
  EJECUTAR:                { bg: "#fef9c3", color: "#a16207" },
  WHATSAPP_RECORDATORIOS:  { bg: "#dcfce7", color: "#15803d" },
};

const ACCIONES = ["CREAR", "ACTUALIZAR", "ELIMINAR", "SUSPENDER", "ACTIVAR", "VERIFICAR", "EJECUTAR"];

function AccionBadge({ accion }: { accion: string }) {
  const style = ACCION_COLORS[accion] ?? { bg: "#f1f5f9", color: "#64748b" };
  return (
    <span style={{
      padding: "2px 8px", borderRadius: "10px", fontSize: "11px",
      fontWeight: 600, background: style.bg, color: style.color,
      whiteSpace: "nowrap",
    }}>
      {accion}
    </span>
  );
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("es-MX", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

export function AuditLogPage() {
  const [page, setPage]           = useState(1);
  const [search, setSearch]       = useState("");
  const [accion, setAccion]       = useState("");
  const [usuarioId, setUsuarioId] = useState<number | undefined>();
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [expanded, setExpanded]   = useState<number | null>(null);

  const debouncedSearch = useDebounce(search, 300);

  const { data, isLoading, isError } = useAuditLogs({
    page,
    page_size: PAGE_SIZE,
    search: debouncedSearch || undefined,
    accion: accion || undefined,
    usuario_id: usuarioId,
    fecha_desde: fechaDesde || undefined,
    fecha_hasta: fechaHasta || undefined,
  });

  const { data: usuarios } = useAuditUsuarios();

  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE));

  function resetFilters() {
    setSearch(""); setAccion("");
    setUsuarioId(undefined); setFechaDesde(""); setFechaHasta("");
    setPage(1);
  }

  const hasFilters = search || accion || usuarioId || fechaDesde || fechaHasta;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>

      {/* Filtros */}
      <div style={{
        background: "white", borderRadius: "10px", border: "1px solid #e2e8f0",
        padding: "14px 18px", boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
      }}>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "flex-end" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <label style={labelStyle}>Buscar</label>
            <input
              type="text"
              placeholder="Descripción o usuario..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              style={{ ...inputStyle, minWidth: "240px" }}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <label style={labelStyle}>Acción</label>
            <select value={accion} onChange={e => { setAccion(e.target.value); setPage(1); }} style={selectStyle}>
              <option value="">Todas</option>
              {ACCIONES.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <label style={labelStyle}>Usuario</label>
            <select
              value={usuarioId ?? ""}
              onChange={e => { setUsuarioId(e.target.value ? Number(e.target.value) : undefined); setPage(1); }}
              style={selectStyle}
            >
              <option value="">Todos</option>
              {(usuarios ?? []).map(u => (
                <option key={u.id ?? "null"} value={u.id ?? ""}>{u.nombre}</option>
              ))}
            </select>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <label style={labelStyle}>Desde</label>
            <input type="date" value={fechaDesde} onChange={e => { setFechaDesde(e.target.value); setPage(1); }} style={inputStyle} />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <label style={labelStyle}>Hasta</label>
            <input type="date" value={fechaHasta} onChange={e => { setFechaHasta(e.target.value); setPage(1); }} style={inputStyle} />
          </div>

          {hasFilters && (
            <button onClick={resetFilters} style={{
              padding: "7px 12px", borderRadius: "6px", border: "1px solid #e2e8f0",
              background: "white", fontSize: "12px", color: "#64748b", cursor: "pointer",
              alignSelf: "flex-end",
            }}>
              Limpiar filtros
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: "12px", color: "#94a3b8" }}>
          {isLoading ? "Cargando..." : `${data?.total ?? 0} registros en el log`}
        </span>
        <span style={{ fontSize: "12px", color: "#94a3b8" }}>
          Página {page} de {totalPages}
        </span>
      </div>

      {/* Tabla */}
      <div style={{
        background: "white", borderRadius: "10px", border: "1px solid #e2e8f0",
        boxShadow: "0 1px 2px rgba(0,0,0,0.04)", overflow: "hidden",
      }}>
        {isError && (
          <div style={{ padding: "40px", textAlign: "center", color: "#dc2626", fontSize: "14px" }}>
            Error al cargar el log de auditoría.
          </div>
        )}

        {!isLoading && !isError && (data?.items ?? []).length === 0 && (
          <div style={{ padding: "48px", textAlign: "center", color: "#94a3b8", fontSize: "14px" }}>
            No hay registros que coincidan con los filtros.
          </div>
        )}

        {(data?.items ?? []).length > 0 && (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", minWidth: "900px", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
                  <th style={{ ...th, width: "160px" }}>Fecha / Hora</th>
                  <th style={{ ...th, width: "140px" }}>Usuario</th>
                  <th style={{ ...th, width: "90px" }}>Módulo</th>
                  <th style={{ ...th, width: "90px" }}>Acción</th>
                  <th style={th}>Descripción</th>
                  <th style={{ ...th, width: "40px" }}></th>
                </tr>
              </thead>
              <tbody>
                {data!.items.map((entry) => (
                  <LogRow
                    key={entry.id}
                    entry={entry}
                    expanded={expanded === entry.id}
                    onToggle={() => setExpanded(expanded === entry.id ? null : entry.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Paginación */}
      {totalPages > 1 && (
        <div style={{ display: "flex", gap: "4px", alignItems: "center", justifyContent: "flex-end" }}>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={btnStyle(page === 1)}>
            ← Anterior
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
            .reduce<(number | "...")[]>((acc, p, idx, arr) => {
              if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push("...");
              acc.push(p);
              return acc;
            }, [])
            .map((p, idx) =>
              p === "..." ? (
                <span key={`e-${idx}`} style={{ color: "#94a3b8", padding: "0 2px" }}>…</span>
              ) : (
                <button key={p} onClick={() => setPage(p as number)} style={btnStyle(false, p === page)}>
                  {p}
                </button>
              )
            )}
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={btnStyle(page === totalPages)}>
            Siguiente →
          </button>
        </div>
      )}
    </div>
  );
}

const ESTADO_COLOR: Record<string, string> = {
  enviado: "#16a34a", sin_telefono: "#d97706", error: "#dc2626",
};

function ExtraDetail({ data }: { data: Record<string, unknown> }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      {Object.entries(data).map(([k, v]) => {
        if (v === null || v === undefined) return null;

        // Array de objetos → mini tabla
        if (Array.isArray(v) && v.length > 0 && typeof v[0] === "object") {
          // Recopilar todas las columnas únicas de todos los objetos del array
          const cols = [...new Set((v as Record<string, unknown>[]).flatMap(row => Object.keys(row)))];
          return (
            <div key={k}>
              <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", marginBottom: "6px" }}>{k}</div>
              <div style={{ overflowX: "auto", maxHeight: "260px", overflowY: "auto", border: "1px solid #e2e8f0", borderRadius: "6px" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                  <thead>
                    <tr style={{ background: "#f1f5f9" }}>
                      {cols.map(c => (
                        <th key={c} style={{ padding: "5px 10px", textAlign: "left", fontWeight: 600, color: "#475569", whiteSpace: "nowrap" }}>{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(v as Record<string, unknown>[]).map((row, i) => (
                      <tr key={i} style={{ borderTop: "1px solid #f1f5f9" }}>
                        {cols.map(c => {
                          const val = row[c];
                          const isEstado = c === "estado";
                          return (
                            <td key={c} style={{ padding: "5px 10px", color: isEstado ? (ESTADO_COLOR[String(val)] ?? "#334155") : "#334155", fontWeight: isEstado ? 600 : 400, whiteSpace: "nowrap" }}>
                              {val === null || val === undefined ? "—" : String(val)}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        }

        // Objeto simple → key: value chips
        if (typeof v === "object" && !Array.isArray(v)) {
          return (
            <div key={k}>
              <span style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>{k}: </span>
              <span style={{ fontSize: "12px", color: "#334155" }}>{JSON.stringify(v)}</span>
            </div>
          );
        }

        // Primitivo
        return (
          <div key={k} style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: "6px", padding: "5px 10px", fontSize: "12px", display: "inline-block" }}>
            <span style={{ color: "#94a3b8", fontWeight: 600 }}>{k}: </span>
            <span style={{ color: "#334155" }}>{String(v)}</span>
          </div>
        );
      })}
    </div>
  );
}

function LogRow({ entry, expanded, onToggle }: {
  entry: AuditLogEntry;
  expanded: boolean;
  onToggle: () => void;
}) {
  const parsedExtra = (() => {
    if (!entry.datos_extra) return null;
    try { return JSON.parse(entry.datos_extra); }
    catch { return null; }
  })();

  return (
    <>
      <tr
        style={{ borderBottom: "1px solid #f1f5f9", background: expanded ? "#f8faff" : "white" }}
        onMouseEnter={e => { if (!expanded) (e.currentTarget as HTMLTableRowElement).style.background = "#f8fafc"; }}
        onMouseLeave={e => { if (!expanded) (e.currentTarget as HTMLTableRowElement).style.background = "white"; }}
      >
        <td style={{ ...td, color: "#64748b", fontSize: "12px", whiteSpace: "nowrap" }}>
          {formatDate(entry.created_at)}
        </td>
        <td style={{ ...td, fontWeight: 500, color: "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "140px" }}>
          {entry.usuario_nombre}
        </td>
        <td style={{ ...td, color: "#475569" }}>
          <span style={{ padding: "2px 7px", borderRadius: "8px", fontSize: "11px", background: "#f1f5f9", color: "#475569", fontWeight: 500 }}>
            {entry.modulo}
          </span>
        </td>
        <td style={td}>
          <AccionBadge accion={entry.accion} />
        </td>
        <td style={{ ...td, color: "#334155" }}>
          {entry.descripcion}
        </td>
        <td style={{ ...td, textAlign: "center" }}>
          {parsedExtra && (
            <button
              onClick={onToggle}
              title="Ver detalles"
              style={{
                background: "none", border: "1px solid #e2e8f0", borderRadius: "4px",
                cursor: "pointer", padding: "2px 6px", fontSize: "12px", color: "#64748b",
              }}
            >
              {expanded ? "▲" : "▼"}
            </button>
          )}
        </td>
      </tr>
      {expanded && parsedExtra && (
        <tr style={{ background: "#f8faff" }}>
          <td colSpan={6} style={{ padding: "10px 16px 14px 48px", borderBottom: "1px solid #e2e8f0" }}>
            <ExtraDetail data={parsedExtra} />
          </td>
        </tr>
      )}
    </>
  );
}

const labelStyle: React.CSSProperties = {
  fontSize: "11px", fontWeight: 600, color: "#64748b",
  textTransform: "uppercase", letterSpacing: "0.05em",
};

const inputStyle: React.CSSProperties = {
  padding: "7px 11px", borderRadius: "6px", border: "1px solid #e2e8f0",
  fontSize: "13px", color: "#334155", outline: "none", background: "#f8fafc",
};

const selectStyle: React.CSSProperties = {
  ...inputStyle as object,
  minWidth: "130px", cursor: "pointer",
} as React.CSSProperties;

const th: React.CSSProperties = {
  padding: "9px 14px", fontWeight: 600, fontSize: "11px", color: "#64748b",
  textAlign: "left", textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap",
};

const td: React.CSSProperties = { padding: "10px 14px", color: "#334155" };

function btnStyle(disabled: boolean, active = false): React.CSSProperties {
  return {
    padding: "5px 11px", borderRadius: "6px", border: "1px solid",
    borderColor: active ? "#2563eb" : "#e2e8f0",
    background: active ? "#2563eb" : disabled ? "#f8fafc" : "white",
    color: active ? "white" : disabled ? "#cbd5e1" : "#334155",
    cursor: disabled ? "not-allowed" : "pointer",
    fontSize: "12px", fontWeight: active ? 600 : 400,
  };
}
