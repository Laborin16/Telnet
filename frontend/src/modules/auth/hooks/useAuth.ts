import { useState, useMemo } from "react";

export interface AuthUser {
  id: number;
  wisphub_id: number | null;
  username: string;
  nombre: string;
  es_admin: boolean;
  debe_cambiar_password: boolean;
}

const TOKEN_KEY = "wisp_token";

function decodeToken(token: string): (AuthUser & { exp: number }) | null {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return {
      id: Number(payload.sub),
      wisphub_id: payload.wisphub_id ?? null,
      username: payload.username ?? "",
      nombre: payload.nombre ?? "",
      es_admin: payload.es_admin ?? false,
      debe_cambiar_password: payload.debe_cambiar_password ?? false,
      exp: payload.exp ?? 0,
    };
  } catch {
    return null;
  }
}

function isExpired(exp: number): boolean {
  return exp * 1000 < Date.now();
}

export function useAuth() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));

  const user = useMemo<AuthUser | null>(() => {
    if (!token) return null;
    const decoded = decodeToken(token);
    if (!decoded || isExpired(decoded.exp)) {
      localStorage.removeItem(TOKEN_KEY);
      return null;
    }
    return decoded;
  }, [token]);

  function login(newToken: string) {
    localStorage.setItem(TOKEN_KEY, newToken);
    setToken(newToken);
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
  }

  return {
    token,
    user,
    isAuthenticated: !!user,
    login,
    logout,
  };
}

export function getStoredToken(): string | null {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return null;
  const decoded = decodeToken(token);
  if (!decoded || isExpired(decoded.exp)) {
    localStorage.removeItem(TOKEN_KEY);
    return null;
  }
  return token;
}
