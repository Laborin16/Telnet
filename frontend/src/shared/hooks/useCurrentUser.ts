import { useState, useCallback } from "react";

export interface CurrentUser {
  id: number;
  nombre: string;
}

const STORAGE_KEY = "wisp_usuario";

function readStored(): CurrentUser | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as CurrentUser;
  } catch {}
  return null;
}

export function useCurrentUser() {
  const [user, setUserState] = useState<CurrentUser | null>(readStored);

  const setUser = useCallback((u: CurrentUser | null) => {
    if (u) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
    setUserState(u);
  }, []);

  return { user, setUser };
}

export function getStoredUser(): CurrentUser | null {
  return readStored();
}
