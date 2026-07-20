import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { useMyRoles } from "../lib/roles";

export function TopBar() {
  const { signOut } = useAuth();
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
  return (
    <header style={{ height: 56, borderBottom: "1px solid var(--hairline)", background: "var(--canvas)", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px" }}>
      <span style={{ fontWeight: 600 }}>{roles.data?.isSuperAdmin ? "Platform" : org.data ?? ""}</span>
      <button onClick={() => signOut()} style={{ border: "1px solid var(--hairline)", background: "var(--canvas)", borderRadius: "var(--radius-pill)", padding: "6px 14px", cursor: "pointer" }}>Sign out</button>
    </header>
  );
}
