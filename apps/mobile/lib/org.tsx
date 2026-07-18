import { createContext, useContext, useState, type ReactNode } from "react";
type OrgValue = { selectedOrgId: string | null; loading: boolean; selectOrg: (id: string) => Promise<void>; clearOrg: () => Promise<void> };
const OrgContext = createContext<OrgValue | undefined>(undefined);
export function OrgProvider({ children }: { children: ReactNode }) {
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  return <OrgContext.Provider value={{ selectedOrgId, loading: false, selectOrg: async (id) => setSelectedOrgId(id), clearOrg: async () => setSelectedOrgId(null) }}>{children}</OrgContext.Provider>;
}
export function useOrg(): OrgValue {
  const ctx = useContext(OrgContext);
  if (!ctx) throw new Error("useOrg must be used within OrgProvider");
  return ctx;
}
