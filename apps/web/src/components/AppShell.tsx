import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

export function AppShell() {
  return (
    <div style={{ display: "flex", height: "100%", background: "var(--parchment)" }}>
      <Sidebar />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <TopBar />
        <main className="rp-scroll" style={{ flex: 1, overflowY: "auto", background: "var(--parchment)" }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
