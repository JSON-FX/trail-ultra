import { useAuth } from "../lib/auth";

export function NoAccess() {
  const { signOut } = useAuth();
  return (
    <div style={{ minHeight: "100%", display: "grid", placeItems: "center", textAlign: "center" }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>No admin access</h1>
        <p style={{ color: "var(--ink-muted)" }}>This account isn't an organizer on Race Pace.</p>
        <button onClick={() => signOut()} style={{ marginTop: 8 }}>Sign out</button>
      </div>
    </div>
  );
}
