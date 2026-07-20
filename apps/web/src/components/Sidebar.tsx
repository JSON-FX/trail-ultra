import { NavLink } from "react-router-dom";
import { useMyRoles } from "../lib/roles";

const ORG_ITEMS = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/events", label: "Events" },
  { to: "/registrations", label: "Registrations" },
  { to: "/payments", label: "Payments" },
  { to: "/check-in", label: "Check-in" },
  { to: "/settings", label: "Settings" },
];
const SUPER_ITEMS = [
  { to: "/organizations", label: "Organizations" },
  { to: "/commission", label: "Commission" },
  { to: "/payouts", label: "Payouts" },
];

export function Sidebar() {
  const roles = useMyRoles();
  const items = [...ORG_ITEMS, ...(roles.data?.isSuperAdmin ? SUPER_ITEMS : [])];
  return (
    <nav style={{ width: 220, borderRight: "1px solid var(--hairline)", background: "var(--canvas)", padding: 16, display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ fontWeight: 700, fontSize: 17, padding: "6px 10px 14px" }}>Race Pace</div>
      {items.map((it) => (
        <NavLink key={it.to} to={it.to} style={({ isActive }) => ({
          padding: "9px 10px", borderRadius: 8, textDecoration: "none", fontSize: 14,
          color: isActive ? "var(--primary)" : "var(--ink)",
          background: isActive ? "var(--parchment)" : "transparent", fontWeight: isActive ? 600 : 400,
        })}>{it.label}</NavLink>
      ))}
    </nav>
  );
}
