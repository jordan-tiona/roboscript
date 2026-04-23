import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getSession, signOut as apiSignOut, type SessionUser } from "../api/auth.js";

interface AuthState {
  user: SessionUser | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    const u = await getSession();
    setUser(u);
  };

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, []);

  const signOut = async () => {
    await apiSignOut();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signOut, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
