import { useEffect, useState } from "react";
import { NominaDashboardTab } from "../components/NominaDashboardTab";
import { NominaPeriodosTab } from "../components/NominaPeriodosTab";
import { NominaPrestamosTab } from "../components/NominaPrestamosTab";
import { useCrearPeriodo } from "../hooks/useNomina";


type SubTab = "periodos" | "prestamos" | "dashboard";


export function NominaPage() {
  const [sub, setSub] = useState<SubTab>("periodos");

  // Al entrar al módulo, garantiza que existe el período de la semana actual y
  // sincroniza empleados marcados en nómina. crear_periodo es idempotente:
  // si ya existe en BORRADOR, agrega solo los empleados faltantes; si está
  // CERRADA, no toca nada.
  const crear = useCrearPeriodo();
  useEffect(() => {
    crear.mutate(undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px", padding: "16px 20px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <h1 style={{ margin: 0, fontSize: "20px", fontWeight: 700, color: "#0f172a" }}>Nómina</h1>
        <div style={{ display: "flex", gap: "4px", background: "#f1f5f9", padding: "3px", borderRadius: "8px" }}>
          <SubBtn active={sub === "periodos"}  onClick={() => setSub("periodos")}>Períodos</SubBtn>
          <SubBtn active={sub === "prestamos"} onClick={() => setSub("prestamos")}>Préstamos</SubBtn>
          <SubBtn active={sub === "dashboard"} onClick={() => setSub("dashboard")}>Dashboard</SubBtn>
        </div>
      </div>

      {sub === "periodos"  && <NominaPeriodosTab />}
      {sub === "prestamos" && <NominaPrestamosTab />}
      {sub === "dashboard" && <NominaDashboardTab />}
    </div>
  );
}


function SubBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{
      padding: "7px 14px", borderRadius: "6px", border: "none",
      background: active ? "white" : "transparent",
      color: active ? "#1d4ed8" : "#64748b",
      fontSize: "13px", fontWeight: 600, cursor: "pointer",
      boxShadow: active ? "0 1px 3px rgba(0,0,0,0.06)" : "none",
    }}>{children}</button>
  );
}
