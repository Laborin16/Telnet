import { useState, useEffect, useRef } from "react";
import { useSaveObservacion } from "../hooks/useCobranza";

interface Props {
  entityType: string;
  entityId: number;
  value?: string | null;
}

export function ObservacionCell({ entityType, entityId, value }: Props) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(value ?? "");
  const [saved, setSaved] = useState(value ?? "");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { mutate, isPending } = useSaveObservacion();

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  // Sync if parent value changes (e.g. after refetch)
  useEffect(() => {
    setSaved(value ?? "");
    setText(value ?? "");
  }, [value]);

  function handleSave() {
    if (text === saved) { setEditing(false); return; }
    mutate(
      { entity_type: entityType, entity_id: entityId, notas: text },
      {
        onSuccess: () => {
          setSaved(text);
          setEditing(false);
        },
      }
    );
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSave(); }
    if (e.key === "Escape") { setText(saved); setEditing(false); }
  }

  if (editing) {
    return (
      <td style={{ padding: "6px 16px", verticalAlign: "top" }}>
        <textarea
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleSave}
          rows={2}
          disabled={isPending}
          style={{
            fontSize: "12px", padding: "4px 8px", borderRadius: "6px",
            border: "1px solid #6366f1", outline: "none", resize: "vertical",
            width: "160px", fontFamily: "inherit", color: "#1e293b",
            backgroundColor: isPending ? "#f1f5f9" : "white",
          }}
        />
      </td>
    );
  }

  return (
    <td
      onClick={() => setEditing(true)}
      title={saved || "Clic para agregar observación"}
      style={{
        padding: "10px 16px", cursor: "pointer", verticalAlign: "middle",
        color: saved ? "#1e293b" : "#94a3b8", fontSize: "13px",
        maxWidth: "180px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        borderBottom: "1px solid #e2e8f0",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#f8fafc"; }}
      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = ""; }}
    >
      {saved || "—"}
    </td>
  );
}
