export function Placeholder({ title }: { title: string }) {
  return (
    <div style={{ padding: 32 }}>
      <h1 style={{ fontSize: 26, fontWeight: 700, color: "var(--ink)" }}>{title}</h1>
      <p style={{ color: "var(--ink-muted)" }}>Coming soon.</p>
    </div>
  );
}
