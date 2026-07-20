export function Placeholder({ title }: { title: string }) {
  return (
    <div style={{ padding: "26px 30px 40px" }}>
      <div style={{ background: "var(--canvas)", border: "1px solid var(--hairline)", borderRadius: "var(--radius-card)", padding: "40px 24px", textAlign: "center" }}>
        <div style={{ fontSize: 16, fontWeight: 600 }}>{title}</div>
        <div style={{ color: "var(--ink-muted)", fontSize: 14, marginTop: 6 }}>Coming soon.</div>
      </div>
    </div>
  );
}
