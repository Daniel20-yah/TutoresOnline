import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, get, tokenStore, setUnauthorizedHandler } from "./api.js";

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(!!tokenStore.get());
  const [unread, setUnread] = useState(0);

  const logout = useCallback(() => { tokenStore.clear(); setUser(null); setUnread(0); }, []);
  useEffect(() => { setUnauthorizedHandler(logout); }, [logout]);

  const refreshMe = useCallback(async () => { setUser(await get("/me")); }, []);

  useEffect(() => {
    if (!tokenStore.get()) return;
    get("/me").then(setUser).catch(() => tokenStore.clear()).finally(() => setLoading(false));
  }, []);

  // contador de notificaciones sin leer
  useEffect(() => {
    if (!user) return undefined;
    let alive = true;
    const load = () => get("/notifications").then((n) => alive && setUnread(n.filter((x) => !x.read).length)).catch(() => {});
    load();
    const t = setInterval(load, 8000);
    return () => { alive = false; clearInterval(t); };
  }, [user]);

  const login = async (email, password) => {
    const r = await api("POST", "/auth/login", { email, password });
    tokenStore.set(r.token);
    setUser(await get("/me"));
  };
  const register = async (payload) => {
    const r = await api("POST", "/auth/register", payload);
    tokenStore.set(r.token);
    setUser(await get("/me"));
  };

  return <Ctx.Provider value={{ user, loading, login, register, logout, refreshMe, unread, setUnread }}>{children}</Ctx.Provider>;
}
