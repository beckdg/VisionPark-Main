import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { apiClient } from "../api/apiClient";
import { resolveDriverProfilePhoto } from "../utils/resolveDriverProfilePhoto";

const AuthContext = createContext({
  user: null,
  token: null,
  isAuthenticated: false,
  isBootstrapping: true,
  login: async () => {},
  refreshMe: async () => {},
  logout: () => {},
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);

  const logout = useCallback(() => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("user");
    try {
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith("vp_") && key !== "vp_theme") {
          localStorage.removeItem(key);
        }
      });
    } catch {
      /* ignore */
    }
    setToken(null);
    setUser(null);
  }, []);

  const login = useCallback(async (email, password) => {
    const data = await apiClient.post("/auth/login", { email, password });

    const nextToken = data?.token;
    const nextUser = data?.user;
    if (!nextToken || !nextUser) {
      throw new Error("Invalid login response from server.");
    }

    localStorage.setItem("accessToken", nextToken);
    localStorage.setItem("user", JSON.stringify(nextUser));
    if (nextUser.role === "driver") {
      try {
        localStorage.removeItem("vp_driver_photo");
      } catch {
        /* ignore */
      }
    }
    setToken(nextToken);
    setUser(nextUser);
    return nextUser;
  }, []);

  const refreshMe = useCallback(async () => {
    const me = await apiClient.get("/auth/me");
    if (me?.role === "driver") {
      try {
        resolveDriverProfilePhoto(me, localStorage.getItem("vp_driver_photo"));
      } catch {
        /* ignore */
      }
    }
    setUser(me);
    localStorage.setItem("user", JSON.stringify(me));
    return me;
  }, []);

  useEffect(() => {
    const bootstrapAuth = async () => {
      const storedToken = localStorage.getItem("accessToken");
      if (!storedToken) {
        setIsBootstrapping(false);
        return;
      }

      setToken(storedToken);
      try {
        await refreshMe();
      } catch {
        logout();
      } finally {
        setIsBootstrapping(false);
      }
    };

    bootstrapAuth();
  }, [logout, refreshMe]);

  const value = useMemo(
    () => ({
      user,
      token,
      isAuthenticated: Boolean(token && user),
      isBootstrapping,
      login,
      refreshMe,
      logout,
    }),
    [user, token, isBootstrapping, login, refreshMe, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

