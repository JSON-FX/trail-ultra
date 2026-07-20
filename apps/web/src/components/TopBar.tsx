import { useQuery } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useMyRoles } from "../lib/roles";

const TITLES: Record<string, string> = {
  "/dashboard": "Dashboard", "/events": "Events", "/registrations": "Registrations",
  "/payments": "Payments", "/check-in": "Race-day check-in", "/settings": "Settings",
  "/organizations": "Organizations", "/commission": "Commission", "/payouts": "Payout statements",
};

export function TopBar() {
  const { pathname } = useLocation();
  const roles = useMyRoles();
  const orgId = roles.data?.orgId;
  const org = useQuery({
    queryKey: ["org-name", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data } = await supabase.from("organizations").select("name").eq("id", orgId).single();
      return data?.name ?? "";
    },
  });
  const title = pathname === "/events/new" ? "Create event"
    : /^\/events\/[^/]+\/edit$/.test(pathname) ? "Edit event"
    : TITLES[pathname] ?? "Dashboard";
  const orgLabel = roles.data?.isSuperAdmin ? "Platform · Super admin" : org.data ?? "";

  return (
    <header style={{ height: 66, flex: "none", background: "var(--canvas)", borderBottom: "1px solid var(--hairline)", display: "flex", alignItems: "center", padding: "0 30px", gap: 18 }}>
      <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-.3px" }}>{title}</div>
      {orgLabel ? (
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8, background: "var(--parchment)", borderRadius: 9, padding: "7px 13px", fontSize: 13, fontWeight: 600 }}>
          {orgLabel}
        </div>
      ) : null}
    </header>
  );
}
