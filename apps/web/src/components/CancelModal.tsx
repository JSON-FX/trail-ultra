import { useState } from "react";
import { cancelEvent } from "../lib/eventWrites";

const overlay = { position: "fixed", inset: 0, background: "rgba(0,0,0,.3)", display: "grid", placeItems: "center", zIndex: 50 } as const;
const box = { width: 380, background: "var(--canvas)", borderRadius: 16, padding: 24 } as const;
const input = { border: "1px solid var(--hairline)", borderRadius: 11, padding: "12px 13px", fontSize: 14, width: "100%" } as const;

export function CancelModal({ event, onClose, onDone }: { event: { id: string; name: string }; onClose: () => void; onDone: () => void }) {
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit() {
    setBusy(true); setError(null);
    const { error } = await cancelEvent(event.id, note);
    setBusy(false);
    if (error) setError(error); else { onDone(); onClose(); }
  }
  return (
    <div style={overlay} onClick={onClose}>
      <div style={box} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontSize: 17, fontWeight: 700 }}>Cancel “{event.name}”?</div>
        <p style={{ color: "var(--ink-muted)", fontSize: 13 }}>Registrations are kept; refunds are handled from Payments.</p>
        <div style={{ display: "grid", gap: 12 }}>
          <input aria-label="Cancel note" placeholder="Reason (optional)" style={input} value={note} onChange={(e) => setNote(e.target.value)} />
          {error ? <span style={{ color: "var(--danger)", fontSize: 13 }}>{error}</span> : null}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <button onClick={onClose} style={{ background: "var(--canvas)", border: "1px solid var(--hairline)", borderRadius: "var(--radius-pill)", padding: "9px 18px", fontWeight: 600, cursor: "pointer" }}>Keep it</button>
            <button onClick={submit} disabled={busy} style={{ background: "var(--danger)", color: "#fff", border: 0, borderRadius: "var(--radius-pill)", padding: "9px 20px", fontWeight: 600, cursor: "pointer" }}>{busy ? "Cancelling…" : "Cancel event"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
