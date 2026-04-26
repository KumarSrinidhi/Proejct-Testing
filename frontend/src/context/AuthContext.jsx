import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { authApi } from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = async () => {
    const response = await authApi.me();
    setUser(response.data);
    sessionStorage.setItem("is_authed", "1");
    return response.data;
  };

  useEffect(() => {
    let active = true;

    authApi
      .me()
      .then((response) => {
        if (!active) return;
        setUser(response.data);
        sessionStorage.setItem("is_authed", "1");
      })
      .catch(() => {
        if (!active) return;
        setUser(null);
        sessionStorage.removeItem("is_authed");
      })
      .finally(() => {
        if (!active) return;
        setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const logout = async () => {
    try {
      await authApi.logout();
    } catch (_err) {
      // Best effort logout.
    }
    setUser(null);
    sessionStorage.removeItem("is_authed");
  };

  const value = useMemo(() => {
    const role = user?.role || "student";
    return {
      user,
      role,
      isAdmin: role === "admin" || Boolean(user?.is_admin),
      isAuthed: Boolean(user),
      isLoading,
      setUser,
      refreshUser,
      logout,
    };
  }, [user, isLoading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
