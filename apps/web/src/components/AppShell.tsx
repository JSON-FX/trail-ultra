import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

export function AppShell() {
  return (
    <div style={{ display: "flex", height: "100%" }}>
      <Sidebar />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <TopBar />
        <main style={{ flex: 1, overflow: "auto", background: "var(--parchment)" }}><Outlet /></main>
      </div>
    </div>
  );
}
