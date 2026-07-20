import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import logo from "../assets/login-logo.png";

export function Login() {
  const { signIn, session } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
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
    <div style={{ minHeight: "100%", display: "grid", placeItems: "center", background: "var(--parchment)", padding: 24 }}>
      <form onSubmit={onSubmit} style={{ width: 400, maxWidth: "100%", background: "var(--canvas)", border: "1px solid var(--hairline)", borderRadius: 22, padding: "38px 36px" }}>
        <img src={logo} alt="Race Pace" style={{ display: "block", height: 34, width: "auto", maxWidth: 190, margin: "0 auto" }} />
        <div style={{ textAlign: "center", color: "var(--ink-muted)", fontSize: 13, marginTop: 8 }}>Event admin console</div>

        <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-.3px", margin: "28px 0 0" }}>Sign in</h1>

        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 16 }}>
          <label style={fieldStyle}>
            <span style={labelStyle}>EMAIL</span>
            <input aria-label="Email" type="email" autoCapitalize="none" placeholder="alma@aposkyrunners.ph"
              value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} />
          </label>
          <label style={fieldStyle}>
            <span style={labelStyle}>PASSWORD</span>
            <div style={{ ...inputStyle, display: "flex", alignItems: "center", padding: 0 }}>
              <input aria-label="Password" type={show ? "text" : "password"} placeholder="••••••••••"
                value={password} onChange={(e) => setPassword(e.target.value)}
                style={{ flex: 1, border: 0, outline: "none", background: "transparent", padding: "12px 13px", fontSize: 14, color: "var(--ink)" }} />
              <span onClick={() => setShow((v) => !v)} role="switch" aria-checked={show} aria-label="Show password"
                style={{ color: "var(--primary)", fontSize: 13, fontWeight: 600, cursor: "pointer", padding: "0 13px", userSelect: "none" }}>
                {show ? "Hide" : "Show"}
              </span>
            </div>
          </label>
        </div>

        {error ? <p style={{ color: "var(--danger)", margin: "14px 0 0", fontSize: 14 }}>{error}</p> : null}

        <button type="submit" disabled={busy} style={pillStyle}>{busy ? "Signing in…" : "Sign in"}</button>

        <p style={{ textAlign: "center", color: "var(--ink-muted)", fontSize: 12, margin: "16px 0 0" }}>
          Admin &amp; staff accounts are provisioned by Race Pace.
        </p>
      </form>
    </div>
  );
}

const fieldStyle = { display: "block" } as const;
const labelStyle = { display: "block", fontSize: 11, fontWeight: 600, letterSpacing: ".4px", color: "var(--ink-muted)", marginBottom: 6 } as const;
const inputStyle = { background: "var(--canvas)", border: "1px solid var(--hairline)", borderRadius: 11, padding: "12px 13px", color: "var(--ink)", fontSize: 14, width: "100%" } as const;
const pillStyle = { width: "100%", background: "var(--primary)", color: "#fff", fontSize: 15, fontWeight: 600, textAlign: "center", padding: 14, borderRadius: "var(--radius-pill)", border: 0, cursor: "pointer", marginTop: 22 } as const;
