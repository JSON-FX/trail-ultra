import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import type { PropsWithChildren } from "react";
import { useAuth } from "./lib/auth";
import { Login } from "./routes/Login";
import { NoAccess } from "./routes/NoAccess";
import { Placeholder } from "./routes/Placeholder";

function RequireAdmin({ children }: PropsWithChildren) {
  const { session, loading } = useAuth();
  if (loading) return <div style={{ padding: 32 }}>Loading…</div>;
  if (!session) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/no-access" element={<NoAccess />} />
        <Route path="/" element={<RequireAdmin><Placeholder title="Race Pace Admin" /></RequireAdmin>} />
      </Routes>
    </BrowserRouter>
  );
}
