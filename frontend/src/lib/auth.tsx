"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";

const TOKEN_KEY = "carbontatva_token";

const rawApiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
export const API_BASE = rawApiBase.replace(/\/$/, "");

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  organization: string;
  role: string;
  status: string;
  created_at: string;
}

interface LoginResponse {
  access_token: string;
  token_type: string;
  user: AuthUser;
}

interface AuthContextValue {
  user: AuthUser | null;
  role: string | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  requestAccess: (
    name: string,
    email: string,
    organization: string,
    password: string
  ) => Promise<void>;
  logout: () => void;
  authFetch: (path: string, options?: RequestInit) => Promise<Response>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function parseApiError(res: Response): Promise<string> {
  try {
    const data = await res.json();
    if (typeof data.detail === "string") return data.detail;
    if (Array.isArray(data.detail)) {
      return data.detail
        .map((item: { msg?: string }) => item.msg || "Validation error")
        .join(", ");
    }
  } catch {
    // fall through
  }
  return res.statusText || "Request failed";
}

function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

function setStoredToken(token: string | null) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const clearSession = useCallback(() => {
    setStoredToken(null);
    setToken(null);
    setUser(null);
  }, []);

  const authFetch = useCallback(
    async (path: string, options: RequestInit = {}) => {
      const currentToken = getStoredToken();
      const headers = new Headers(options.headers);
      if (!headers.has("Content-Type") && options.body) {
        headers.set("Content-Type", "application/json");
      }
      if (currentToken) {
        headers.set("Authorization", `Bearer ${currentToken}`);
      }
      return fetch(`${API_BASE}${path}`, { ...options, headers });
    },
    []
  );

  const fetchMe = useCallback(async (accessToken: string) => {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new Error("Session invalid");
    return (await res.json()) as AuthUser;
  }, []);

  useEffect(() => {
    const stored = getStoredToken();
    if (!stored) {
      setIsLoading(false);
      return;
    }

    setToken(stored);
    fetchMe(stored)
      .then((me) => setUser(me))
      .catch(() => clearSession())
      .finally(() => setIsLoading(false));
  }, [clearSession, fetchMe]);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        throw new Error(await parseApiError(res));
      }

      const data = (await res.json()) as LoginResponse;
      // localStorage is convenient for SPA-style auth; httpOnly cookies would
      // be more secure in production (not accessible to JS, mitigates XSS token theft).
      setStoredToken(data.access_token);
      setToken(data.access_token);
      setUser(data.user);
    },
    []
  );

  const requestAccess = useCallback(
    async (
      name: string,
      email: string,
      organization: string,
      password: string
    ) => {
      const res = await fetch(`${API_BASE}/auth/request-access`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, organization, password }),
      });

      if (!res.ok) {
        throw new Error(await parseApiError(res));
      }
    },
    []
  );

  const logout = useCallback(() => {
    clearSession();
    router.push("/login");
  }, [clearSession, router]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      role: user?.role ?? null,
      token,
      isLoading,
      isAuthenticated: !!user && user.status === "approved",
      login,
      requestAccess,
      logout,
      authFetch,
    }),
    [user, token, isLoading, login, requestAccess, logout, authFetch]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
