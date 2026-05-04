import { useState, useCallback, useRef } from "react";
import { ToastContext, type Toast, type ToastType } from "../hooks/useToast";

const TIPO_STYLE: Record<ToastType, { bg: string; border: string; color: string; icon: string }> = {
  success: { bg: "#f0fdf4", border: "#86efac", color: "#15803d", icon: "✓" },
  error:   { bg: "#fef2f2", border: "#fca5a5", color: "#dc2626", icon: "✕" },
  info:    { bg: "#eff6ff", border: "#93c5fd", color: "#1d4ed8", icon: "ℹ" },
};

let _nextId = 1;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const removeToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) { clearTimeout(timer); timers.current.delete(id); }
  }, []);

  const addToast = useCallback((message: string, type: ToastType = "success") => {
    const id = _nextId++;
    setToasts(prev => [...prev, { id, message, type }]);
    const timer = setTimeout(() => removeToast(id), 3_500);
    timers.current.set(id, timer);
  }, [removeToast]);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
}

function ToastContainer({ toasts, onRemove }: { toasts: Toast[]; onRemove: (id: number) => void }) {
  if (toasts.length === 0) return null;
  return (
    <div style={{
      position: "fixed", bottom: "24px", right: "24px",
      zIndex: 9000, display: "flex", flexDirection: "column", gap: "8px",
      pointerEvents: "none",
    }}>
      {toasts.map(t => {
        const s = TIPO_STYLE[t.type];
        return (
          <div
            key={t.id}
            style={{
              display: "flex", alignItems: "center", gap: "10px",
              padding: "11px 14px", borderRadius: "10px",
              background: s.bg, border: `1px solid ${s.border}`,
              boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
              minWidth: "240px", maxWidth: "360px",
              pointerEvents: "all",
              animation: "toast-in 0.2s ease",
            }}
          >
            <span style={{
              width: "20px", height: "20px", borderRadius: "50%", flexShrink: 0,
              background: s.color, color: "white",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "11px", fontWeight: 700,
            }}>
              {s.icon}
            </span>
            <span style={{ flex: 1, fontSize: "13px", color: s.color, fontWeight: 500, lineHeight: 1.4 }}>
              {t.message}
            </span>
            <button
              onClick={() => onRemove(t.id)}
              style={{
                background: "none", border: "none", cursor: "pointer",
                fontSize: "13px", color: s.color, opacity: 0.6,
                padding: "2px", lineHeight: 1, flexShrink: 0,
              }}
            >
              ✕
            </button>
          </div>
        );
      })}
      <style>{`
        @keyframes toast-in {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
