import { useState, useMemo, useRef, useEffect } from "react";
import { useAllClients } from "./modules/clients/hooks/useAllClients";
import { ClientsTable } from "./modules/clients/components/ClientsTable";
import { useDebounce } from "./shared/hooks/useDebounce";
import { useClientDetail } from "./modules/clients/hooks/useClientDetail";
import { ClientDetailModal } from "./modules/clients/components/ClientDetailModal";
import { DashboardPage } from "./modules/dashboard/pages/DashboardPage";
import { FinanzasPage } from "./modules/finanzas/pages/FinanzasPage";
import { AuditLogPage } from "./modules/auditlog/pages/AuditLogPage";
import { LoginPage } from "./modules/auth/pages/LoginPage";
import { UsuariosPage } from "./modules/auth/pages/UsuariosPage";
import { useObservaciones } from "./modules/finanzas/hooks/useCobranza";
import { useAuth } from "./modules/auth/hooks/useAuth";
import apiClient from "./core/api/apiClient";

type Tab = "clientes" | "dashboard" | "finanzas" | "auditoria" | "usuarios";
const PAGE_SIZE = 25;
const ALERTA_ORDER: Record<string, number> = { critico: 0, pendiente: 1, suspendido: 2, normal: 3 };

const NAV_ITEMS: { key: Tab; label: string; icon: string; adminOnly?: boolean }[] = [
  { key: "clientes",  label: "Clientes",  icon: "👥" },
  { key: "dashboard", label: "Dashboard", icon: "📊" },
  { key: "finanzas",  label: "Finanzas",  icon: "💰" },
  { key: "auditoria", label: "Auditoría", icon: "📋" },
  { key: "usuarios",  label: "Usuarios",  icon: "🔑", adminOnly: true },
];

export default function App() {
  const { user, isAuthenticated, login, logout } = useAuth();

  if (!isAuthenticated) {
    return <LoginPage onLogin={login} />;
  }

  if (user!.debe_cambiar_password) {
    return <ForzarCambioPassword onChanged={login} />;
  }

  return <MainApp user={user!} logout={logout} />;
}

// ── Aplicación principal (solo se monta si autenticado) ──────────────────────

function MainApp({ user, logout }: { user: NonNullable<ReturnType<typeof useAuth>["user"]>; logout: () => void }) {
  const [tab, setTab]       = useState<Tab>("clientes");
  const [page, setPage]     = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<Set<string>>(new Set());
  const [alerta, setAlerta] = useState<Set<string>>(new Set());
  const [planFiltro, setPlanFiltro] = useState("");
  const [zonaFiltro, setZonaFiltro] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showChangePass, setShowChangePass] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const h = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (!mobile) setSidebarOpen(false);
    };
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);

  const debouncedSearch = useDebounce(search, 200);
  const { data: allClients, isLoading, isError } = useAllClients();
  const pageIds = useMemo(() => (allClients ?? []).map(c => c.id_servicio), [allClients]);
  const { data: obsClientes } = useObservaciones("cliente", pageIds, tab === "clientes");
  const { data: detail, isLoading: detailLoading } = useClientDetail(selectedId);

  const handleSearch = (v: string) => { setSearch(v); setPage(1); };
  const handleStatus = (v: Set<string>) => { setStatus(v); setPage(1); };

  const planesUnicos = useMemo(() => {
    if (!allClients) return [];
    const set = new Set<string>();
    allClients.forEach(c => { if (c.plan_internet?.nombre) set.add(c.plan_internet.nombre); });
    return Array.from(set).sort();
  }, [allClients]);

  const zonasUnicas = useMemo(() => {
    if (!allClients) return [];
    const set = new Set<string>();
    allClients.forEach(c => { if (c.zona?.nombre) set.add(c.zona.nombre); });
    return Array.from(set).sort();
  }, [allClients]);

  const filtered = useMemo(() => {
    if (!allClients) return [];
    const q = debouncedSearch.toLowerCase();
    return allClients
      .filter(c => {
        const matchStatus = status.size === 0 || status.has(c.estado);
        const matchAlerta = alerta.size === 0 || (c.alerta_corte !== null && alerta.has(c.alerta_corte));
        const matchSearch = !q ||
          c.nombre.toLowerCase().includes(q) ||
          String(c.id_servicio).includes(q) ||
          (c.telefono ?? "").replace(/\s|-/g, "").includes(q.replace(/\s|-/g, ""));
        const matchPlan = !planFiltro || c.plan_internet?.nombre === planFiltro;
        const matchZona = !zonaFiltro || c.zona?.nombre === zonaFiltro;
        return matchStatus && matchAlerta && matchSearch && matchPlan && matchZona;
      })
      .sort((a, b) => {
        const oa = a.alerta_corte != null ? ALERTA_ORDER[a.alerta_corte] : 4;
        const ob = b.alerta_corte != null ? ALERTA_ORDER[b.alerta_corte] : 4;
        if (oa !== ob) return oa - ob;
        return (a.dias_para_corte ?? 999) - (b.dias_para_corte ?? 999);
      });
  }, [allClients, status, alerta, debouncedSearch, planFiltro, zonaFiltro]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const start      = (page - 1) * PAGE_SIZE;
  const pageItems  = filtered.slice(start, start + PAGE_SIZE);
  const currentNav = NAV_ITEMS.find(i => i.key === tab)!;

  return (
    <div style={{
      display: "flex", height: "100vh",
      fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
      background: "#f1f5f9", overflow: "hidden",
    }}>

      {/* ── Backdrop móvil ───────────────────────────── */}
      {isMobile && sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 499 }}
        />
      )}

      {/* ── Sidebar ──────────────────────────────────── */}
      <aside style={{
        width: "220px", background: "#0f172a",
        display: "flex", flexDirection: "column",
        flexShrink: 0, overflowY: "auto",
        ...(isMobile ? {
          position: "fixed", top: 0, left: 0, bottom: 0, zIndex: 500,
          transform: sidebarOpen ? "translateX(0)" : "translateX(-220px)",
          transition: "transform 0.25s ease",
          boxShadow: sidebarOpen ? "4px 0 24px rgba(0,0,0,0.35)" : "none",
        } : {}),
      }}>
        {/* Brand */}
        <div style={{ padding: "20px 16px 18px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{
              width: "34px", height: "34px", borderRadius: "8px", flexShrink: 0,
              overflow: "hidden",
            }}><img src="/Logo-Telnet.png" alt="Telnet" style={{ width: "100%", height: "100%", objectFit: "contain" }} /></div>
            <div>
              <p style={{ margin: 0, fontSize: "13px", fontWeight: 700, color: "#f8fafc", lineHeight: 1.3 }}>SIT</p>
              <p style={{ margin: 0, fontSize: "11px", color: "#64748b", lineHeight: 1.3 }}>Panel de Control</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ padding: "14px 10px", flex: 1 }}>
          <p style={{ margin: "0 0 8px 8px", fontSize: "10px", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Módulos
          </p>
          {NAV_ITEMS.filter(i => !i.adminOnly || user.es_admin).map(({ key, label, icon }) => {
            const active = tab === key;
            return (
              <button key={key} onClick={() => { setTab(key); if (isMobile) setSidebarOpen(false); }} style={{
                display: "flex", alignItems: "center", gap: "9px",
                width: "100%", padding: "9px 10px", marginBottom: "2px",
                borderRadius: "7px", border: "none", cursor: "pointer",
                fontSize: "13.5px", fontWeight: active ? 600 : 400,
                color: active ? "#f1f5f9" : "#94a3b8",
                background: active ? "rgba(59,130,246,0.18)" : "transparent",
                textAlign: "left",
              }}>
                <span style={{ fontSize: "15px", lineHeight: 1 }}>{icon}</span>
                {label}
              </button>
            );
          })}
        </nav>

        {/* Usuario activo */}
        <div style={{ padding: "12px 10px 10px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <p style={{ margin: "0 0 6px 8px", fontSize: "10px", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Sesión activa
          </p>
          <div style={{
            padding: "8px 10px", borderRadius: "7px",
            background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.25)",
            display: "flex", alignItems: "center", gap: "8px",
          }}>
            <div style={{
              width: "28px", height: "28px", borderRadius: "50%", flexShrink: 0,
              background: "#3b82f6", display: "flex", alignItems: "center",
              justifyContent: "center", fontSize: "12px", color: "white", fontWeight: 700,
            }}>
              {user.nombre.charAt(0).toUpperCase()}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <p style={{ margin: 0, fontSize: "12px", fontWeight: 600, color: "#93c5fd", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {user.nombre}
              </p>
              <p style={{ margin: 0, fontSize: "10px", color: "#475569" }}>{user.username}</p>
            </div>
          </div>
          <div style={{ display: "flex", gap: "6px", marginTop: "6px" }}>
            <button
              onClick={() => setShowChangePass(true)}
              style={{
                flex: 1, padding: "5px 8px", borderRadius: "5px", fontSize: "11px",
                border: "1px solid rgba(255,255,255,0.08)", background: "transparent",
                color: "#64748b", cursor: "pointer",
              }}
            >
              Cambiar clave
            </button>
            <button
              onClick={logout}
              style={{
                flex: 1, padding: "5px 8px", borderRadius: "5px", fontSize: "11px",
                border: "1px solid rgba(220,38,38,0.3)", background: "transparent",
                color: "#f87171", cursor: "pointer",
              }}
            >
              Cerrar sesión
            </button>
          </div>
        </div>

        <div style={{ padding: "8px 16px 12px", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
          <p style={{ margin: 0, fontSize: "11px", color: "#475569" }}>v1.2 · WispHub</p>
        </div>
      </aside>

      {/* ── Main area ─────────────────────────────────── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>

        {/* Top bar */}
        <header style={{
          background: "white", borderBottom: "1px solid #e2e8f0",
          padding: "0 28px", height: "56px", flexShrink: 0,
          display: "flex", alignItems: "center", gap: "14px",
        }}>
          {isMobile && (
            <button
              onClick={() => setSidebarOpen(p => !p)}
              style={{ background: "none", border: "none", cursor: "pointer", fontSize: "22px", lineHeight: 1, padding: "4px", color: "#0f172a", flexShrink: 0 }}
            >
              ☰
            </button>
          )}
          <h1 style={{ margin: 0, fontSize: "17px", fontWeight: 700, color: "#0f172a" }}>
            {currentNav.label}
          </h1>
          {tab === "clientes" && allClients && (
            <span style={{ fontSize: "12px", color: "#94a3b8" }}>{filtered.length} clientes</span>
          )}
        </header>

        {/* Scrollable content */}
        <div style={{ flex: 1, overflowY: "auto", padding: isMobile ? "14px 12px" : "24px 28px" }}>

          {tab === "usuarios"  && <UsuariosPage />}

          {tab === "dashboard" && (
            <DashboardPage
              onNavigateToClients={({ plan, zona }) => {
                setSearch(""); setStatus(new Set()); setAlerta(new Set()); setPage(1);
                setPlanFiltro(plan ?? "");
                setZonaFiltro(zona ?? "");
                setTab("clientes");
              }}
            />
          )}
          {tab === "finanzas"  && <FinanzasPage />}
          {tab === "auditoria" && <AuditLogPage />}

          {tab === "clientes" && (
            <>
              {/* Filter card */}
              <div style={{
                background: "white", borderRadius: "10px", border: "1px solid #e2e8f0",
                padding: "14px 18px", marginBottom: "14px",
                boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
              }}>
                <div style={{ display: "flex", gap: "10px", marginBottom: "10px", flexWrap: "wrap" }}>
                  <input
                    type="text" placeholder="Buscar por nombre, ID o teléfono..."
                    value={search} onChange={e => handleSearch(e.target.value)}
                    style={{ ...inputStyle, minWidth: "260px" }}
                  />
                  <MultiSelect
                    options={[
                      { value: "Activo", label: "Activo" },
                      { value: "Suspendido", label: "Suspendido" },
                      { value: "Cancelado", label: "Cancelado" },
                    ]}
                    selected={status} onChange={handleStatus} placeholder="Todos los estados"
                  />
                  <select
                    value={planFiltro}
                    onChange={e => { setPlanFiltro(e.target.value); setPage(1); }}
                    style={{ ...inputStyle, minWidth: "180px", cursor: "pointer", color: planFiltro ? "#4338ca" : "#94a3b8", background: planFiltro ? "#eef2ff" : "#f8fafc", border: planFiltro ? "1px solid #6366f1" : "1px solid #e2e8f0" }}
                  >
                    <option value="">Todos los planes</option>
                    {planesUnicos.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                  <select
                    value={zonaFiltro}
                    onChange={e => { setZonaFiltro(e.target.value); setPage(1); }}
                    style={{ ...inputStyle, minWidth: "160px", cursor: "pointer", color: zonaFiltro ? "#0e7490" : "#94a3b8", background: zonaFiltro ? "#ecfeff" : "#f8fafc", border: zonaFiltro ? "1px solid #67e8f9" : "1px solid #e2e8f0" }}
                  >
                    <option value="">Todas las zonas</option>
                    {zonasUnicas.map(z => <option key={z} value={z}>{z}</option>)}
                  </select>
                </div>
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
                  <span style={{ fontSize: "11px", color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginRight: "2px" }}>Alerta:</span>
                  {[
                    { key: "",           label: "Todos",     color: "#64748b", activeBg: "#f1f5f9" },
                    { key: "pendiente",  label: "Pendiente", color: "#d97706", activeBg: "#fffbeb" },
                    { key: "suspendido", label: "Suspendido",color: "#64748b", activeBg: "#f8fafc" },
                    { key: "normal",     label: "Normal",    color: "#16a34a", activeBg: "#f0fdf4" },
                  ].map(({ key, label, color, activeBg }) => {
                    const isActive = key === "" ? alerta.size === 0 && !status.has("Cancelado") : alerta.has(key);
                    return (
                      <button key={key} onClick={() => {
                        setPage(1);
                        setStatus(new Set());
                        if (key === "") { setAlerta(new Set()); return; }
                        const next = new Set(alerta);
                        if (next.has(key)) next.delete(key); else next.add(key);
                        setAlerta(next);
                      }} style={{
                        padding: "3px 11px", borderRadius: "20px",
                        border: `1px solid ${isActive ? color : "#e2e8f0"}`,
                        background: isActive ? activeBg : "transparent",
                        color: isActive ? color : "#64748b",
                        fontSize: "12px", fontWeight: isActive ? 600 : 400, cursor: "pointer",
                      }}>
                        {label}
                      </button>
                    );
                  })}
                  {(() => {
                    const isActive = status.has("Cancelado");
                    return (
                      <button onClick={() => {
                        setPage(1);
                        setAlerta(new Set());
                        const next = new Set(status);
                        if (next.has("Cancelado")) next.delete("Cancelado"); else { next.clear(); next.add("Cancelado"); }
                        setStatus(next);
                      }} style={{
                        padding: "3px 11px", borderRadius: "20px",
                        border: `1px solid ${isActive ? "#dc2626" : "#e2e8f0"}`,
                        background: isActive ? "#fef2f2" : "transparent",
                        color: isActive ? "#dc2626" : "#64748b",
                        fontSize: "12px", fontWeight: isActive ? 600 : 400, cursor: "pointer",
                      }}>
                        Cancelados
                      </button>
                    );
                  })()}
                </div>
              </div>

              {isLoading && <p style={{ color: "#94a3b8", fontSize: "14px", padding: "20px 0" }}>Cargando clientes...</p>}
              {isError   && <p style={{ color: "#dc2626", fontSize: "14px", padding: "20px 0" }}>Error al cargar los datos.</p>}

              {allClients && (
                <>
                  <div style={{
                    background: "white", borderRadius: "10px",
                    border: "1px solid #e2e8f0", boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                    overflow: "hidden",
                  }}>
                    <ClientsTable clients={pageItems} onSelect={id => setSelectedId(id)} obsMap={obsClientes} />
                  </div>

                  <div style={{ marginTop: "14px", display: "flex", gap: "4px", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: "12px", color: "#94a3b8" }}>
                      {filtered.length > 0
                        ? `Mostrando ${start + 1}–${Math.min(start + PAGE_SIZE, filtered.length)} de ${filtered.length}`
                        : "Sin resultados"}
                    </span>
                    <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                      <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={btnStyle(page === 1)}>← Anterior</button>
                      {Array.from({ length: totalPages }, (_, i) => i + 1)
                        .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
                        .reduce<(number | "...")[]>((acc, p, idx, arr) => {
                          if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push("...");
                          acc.push(p); return acc;
                        }, [])
                        .map((p, idx) =>
                          p === "..." ? <span key={`e-${idx}`} style={{ color: "#94a3b8", padding: "0 2px" }}>…</span>
                            : <button key={p} onClick={() => setPage(p as number)} style={btnStyle(false, p === page)}>{p}</button>
                        )}
                      <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={btnStyle(page === totalPages)}>Siguiente →</button>
                    </div>
                  </div>
                </>
              )}

              {selectedId !== null && (
                <ClientDetailModal detail={detail} isLoading={detailLoading} onClose={() => setSelectedId(null)} />
              )}
            </>
          )}
        </div>
      </div>

      {showChangePass && <ChangePasswordModal onClose={() => setShowChangePass(false)} />}
    </div>
  );
}

// ── Pantalla forzada de cambio de contraseña ─────────────────────────────────

function ForzarCambioPassword({ onChanged }: { onChanged: (token: string) => void }) {
  const [actual, setActual]       = useState("");
  const [nuevo, setNuevo]         = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [error, setError]         = useState("");
  const [loading, setLoading]     = useState(false);
  const [visible, setVisible]     = useState<Record<string, boolean>>({});

  const toggleVisible = (key: string) => setVisible(v => ({ ...v, [key]: !v[key] }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (nuevo !== confirmar) { setError("Las contraseñas no coinciden."); return; }
    if (nuevo.length < 6)    { setError("Mínimo 6 caracteres."); return; }
    setError(""); setLoading(true);
    try {
      const { data } = await apiClient.post("/api/v1/auth/cambiar-password", {
        password_actual: actual,
        password_nuevo: nuevo,
      });
      onChanged(data.access_token);
    } catch (err: unknown) {
      setError((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Error al cambiar contraseña.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
      padding: "20px",
    }}>
      <div style={{
        background: "white", borderRadius: "16px", padding: "36px 40px",
        width: "100%", maxWidth: "400px",
        boxShadow: "0 25px 60px rgba(0,0,0,0.4)",
      }}>
        <div style={{ textAlign: "center", marginBottom: "24px" }}>
          <div style={{ fontSize: "36px", marginBottom: "10px" }}>🔐</div>
          <h2 style={{ margin: "0 0 6px", fontSize: "20px", fontWeight: 700, color: "#0f172a" }}>
            Cambia tu contraseña
          </h2>
          <p style={{ margin: 0, fontSize: "13px", color: "#64748b", lineHeight: 1.5 }}>
            Tu cuenta tiene una contraseña temporal.<br />
            Debes establecer una nueva para continuar.
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {[
            { key: "actual",    label: "Contraseña temporal",  value: actual,    set: setActual },
            { key: "nuevo",     label: "Nueva contraseña",     value: nuevo,     set: setNuevo },
            { key: "confirmar", label: "Confirmar contraseña", value: confirmar, set: setConfirmar },
          ].map(({ key, label, value, set }) => (
            <div key={key} style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <label style={{ fontSize: "11px", fontWeight: 600, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {label}
              </label>
              <div style={{ position: "relative" }}>
                <input
                  type={visible[key] ? "text" : "password"} value={value} onChange={e => set(e.target.value)} required
                  style={{ width: "100%", boxSizing: "border-box", padding: "10px 40px 10px 12px", borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "14px", color: "#0f172a", outline: "none", background: "#f8fafc" }}
                />
                <button
                  type="button" onClick={() => toggleVisible(key)}
                  style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: "11px", fontWeight: 600, color: "#94a3b8", padding: "2px" }}
                >
                  {visible[key] ? "Ocultar" : "Ver"}
                </button>
              </div>
            </div>
          ))}

          {error && (
            <div style={{ padding: "10px 12px", borderRadius: "8px", background: "#fef2f2", border: "1px solid #fecaca", fontSize: "13px", color: "#dc2626" }}>
              {error}
            </div>
          )}

          <button
            type="submit" disabled={loading}
            style={{
              marginTop: "4px", padding: "11px", borderRadius: "8px", border: "none",
              background: loading ? "#cbd5e1" : "linear-gradient(135deg, #3b82f6, #1d4ed8)",
              color: "white", fontSize: "14px", fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
              boxShadow: loading ? "none" : "0 4px 12px rgba(59,130,246,0.3)",
            }}
          >
            {loading ? "Guardando..." : "Establecer nueva contraseña"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Modal cambiar contraseña ──────────────────────────────────────────────────

function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [actual, setActual]   = useState("");
  const [nuevo, setNuevo]     = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [error, setError]     = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (nuevo !== confirmar) { setError("Las contraseñas no coinciden."); return; }
    if (nuevo.length < 6) { setError("La nueva contraseña debe tener al menos 6 caracteres."); return; }
    setError(""); setLoading(true);
    try {
      await apiClient.post("/api/v1/auth/cambiar-password", {
        password_actual: actual,
        password_nuevo: nuevo,
      });
      setSuccess(true);
    } catch (err: unknown) {
      setError((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Error al cambiar contraseña.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={onClose}>
      <div style={{ background: "white", borderRadius: "12px", padding: "28px", width: "360px", maxWidth: "90vw", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}
        onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#0f172a" }}>Cambiar contraseña</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: "18px", cursor: "pointer", color: "#94a3b8" }}>✕</button>
        </div>

        {success ? (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div style={{ fontSize: "40px", marginBottom: "12px" }}>✅</div>
            <p style={{ fontSize: "14px", color: "#334155", margin: 0 }}>Contraseña actualizada correctamente.</p>
            <button onClick={onClose} style={{ marginTop: "20px", padding: "8px 20px", borderRadius: "7px", border: "none", background: "#2563eb", color: "white", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>
              Cerrar
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {[
              { label: "Contraseña actual",    value: actual,    set: setActual },
              { label: "Nueva contraseña",     value: nuevo,     set: setNuevo },
              { label: "Confirmar contraseña", value: confirmar, set: setConfirmar },
            ].map(({ label, value, set }) => (
              <div key={label} style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <label style={{ fontSize: "12px", fontWeight: 600, color: "#475569" }}>{label}</label>
                <input type="password" value={value} onChange={e => set(e.target.value)}
                  style={{ padding: "9px 12px", borderRadius: "7px", border: "1px solid #e2e8f0", fontSize: "14px", color: "#0f172a", outline: "none" }} />
              </div>
            ))}
            {error && (
              <div style={{ padding: "8px 12px", borderRadius: "7px", background: "#fef2f2", border: "1px solid #fecaca", fontSize: "13px", color: "#dc2626" }}>
                {error}
              </div>
            )}
            <button type="submit" disabled={loading} style={{
              padding: "10px", borderRadius: "7px", border: "none",
              background: loading ? "#cbd5e1" : "#2563eb", color: "white",
              fontSize: "14px", fontWeight: 600, cursor: loading ? "not-allowed" : "pointer",
            }}>
              {loading ? "Guardando..." : "Guardar contraseña"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

// ── MultiSelect ───────────────────────────────────────────────────────────────

function MultiSelect({ options, selected, onChange, placeholder }: {
  options: { value: string; label: string }[];
  selected: Set<string>;
  onChange: (v: Set<string>) => void;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);
  const toggle = (value: string) => { const n = new Set(selected); if (n.has(value)) n.delete(value); else n.add(value); onChange(n); };
  const label = selected.size === 0 ? placeholder : options.filter(o => selected.has(o.value)).map(o => o.label).join(", ");
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button onClick={() => setOpen(p => !p)} style={{
        ...inputStyle, display: "flex", alignItems: "center", gap: "6px", cursor: "pointer",
        border: selected.size > 0 ? "1px solid #6366f1" : "1px solid #e2e8f0",
        background: selected.size > 0 ? "#eef2ff" : "#f8fafc",
        color: selected.size > 0 ? "#4338ca" : "#334155",
      }}>
        <span style={{ flex: 1, textAlign: "left" }}>{label}</span>
        <span style={{ fontSize: "10px", color: "#94a3b8" }}>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 200, background: "white", border: "1px solid #e2e8f0", borderRadius: "8px", boxShadow: "0 4px 16px rgba(0,0,0,0.08)", minWidth: "160px", padding: "4px 0" }}>
          {options.map(opt => (
            <label key={opt.value} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "7px 14px", cursor: "pointer", fontSize: "13px", color: "#1e293b", background: selected.has(opt.value) ? "#eef2ff" : "transparent" }}>
              <input type="checkbox" checked={selected.has(opt.value)} onChange={() => toggle(opt.value)} style={{ cursor: "pointer", accentColor: "#6366f1" }} />
              {opt.label}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  padding: "7px 11px", borderRadius: "6px", border: "1px solid #e2e8f0",
  fontSize: "13px", color: "#334155", outline: "none", minWidth: "220px", background: "#f8fafc",
};

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
