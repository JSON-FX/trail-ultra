import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";

export function Login() {
  const { signIn, session } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (session) nav("/", { replace: true }); }, [session, nav]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    const { error } = await signIn(email.trim(), password);
    setBusy(false);
    if (error) setError(error); else nav("/", { replace: true });
  }

  return (
    <div style={{ minHeight: "100%", display: "grid", placeItems: "center" }}>
      <form onSubmit={onSubmit} style={{ width: 340, background: "var(--canvas)", padding: 28, borderRadius: 14, border: "1px solid var(--hairline)", display: "grid", gap: 12 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Sign in</h1>
        <input aria-label="Email" placeholder="Email" type="email" autoCapitalize="none" value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} />
        <input aria-label="Password" placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={inputStyle} />
        {error ? <p style={{ color: "var(--danger)", margin: 0, fontSize: 14 }}>{error}</p> : null}
        <button type="submit" disabled={busy} style={btnStyle}>{busy ? "Signing in…" : "Sign in"}</button>
      </form>
    </div>
  );
}
const inputStyle = { border: "1px solid var(--hairline)", borderRadius: "var(--radius)", padding: 12, fontSize: 15 } as const;
const btnStyle = { background: "var(--primary)", color: "#fff", border: 0, borderRadius: "var(--radius-pill)", padding: "12px 16px", fontSize: 15, fontWeight: 600, cursor: "pointer" } as const;
