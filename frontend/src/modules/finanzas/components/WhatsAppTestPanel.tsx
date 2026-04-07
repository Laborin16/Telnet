import { useState } from "react";
import apiClient from "../../../core/api/apiClient";

export function WhatsAppTestPanel() {
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "ok" | "error">("idle");
  const [message, setMessage] = useState("");

  async function handleSend() {
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length < 10) {
      setMessage("Ingresa un número válido (ej. 526621234567)");
      setStatus("error");
      return;
    }
    setStatus("sending");
    setMessage("");
    try {
      await apiClient.post("/api/v1/whatsapp/test", { phone: cleaned });
      setStatus("ok");
      setMessage("Mensaje enviado correctamente.");
    } catch (e: unknown) {
      setStatus("error");
      const err = e as { response?: { data?: { detail?: string } } };
      setMessage(err?.response?.data?.detail ? JSON.stringify(err.response.data.detail) : "Error al enviar.");
    }
  }

  return (
    <div style={{
      backgroundColor: "white",
      border: "1px solid #e2e8f0",
      borderRadius: "10px",
      padding: "20px",
      display: "flex",
      flexDirection: "column",
      gap: "12px",
    }}>
      <p style={{ fontSize: "13px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", margin: 0 }}>
        WhatsApp — Prueba de conexión
      </p>

      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        <input
          type="text"
          placeholder="Número destino (ej. 526621234567)"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          style={{
            padding: "8px 12px", borderRadius: "6px", border: "1px solid #e2e8f0",
            fontSize: "14px", color: "#1e293b", outline: "none", minWidth: "260px",
          }}
        />
        <button
          onClick={handleSend}
          disabled={status === "sending"}
          style={{
            padding: "8px 16px", borderRadius: "6px", border: "none",
            backgroundColor: status === "sending" ? "#e2e8f0" : "#25D366",
            color: status === "sending" ? "#94a3b8" : "white",
            fontSize: "14px", fontWeight: 600, cursor: status === "sending" ? "not-allowed" : "pointer",
          }}
        >
          {status === "sending" ? "Enviando..." : "Enviar hello_world"}
        </button>
      </div>

      {message && (
        <p style={{ margin: 0, fontSize: "13px", color: status === "ok" ? "#16a34a" : "#dc2626", fontWeight: 500 }}>
          {status === "ok" ? "✓ " : "✕ "}{message}
        </p>
      )}
    </div>
  );
}
