import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext.js";
import { SplashPage } from "./pages/SplashPage.js";
import { RegisterPage } from "./pages/RegisterPage.js";
import { DashboardPage } from "./pages/DashboardPage.js";

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function RedirectIfAuthed({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

export function App() {
  return (
    <Routes>
      <Route path="/" element={<RedirectIfAuthed><SplashPage /></RedirectIfAuthed>} />
      <Route path="/register" element={<RedirectIfAuthed><RegisterPage /></RedirectIfAuthed>} />
      <Route path="/dashboard" element={<RequireAuth><DashboardPage /></RequireAuth>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
