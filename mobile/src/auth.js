import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { get, post, setToken, setUnauthorizedHandler, loadBase } from "./api";
import { store } from "./config";

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(true);
  const [unread, setUnread] = useState(0);

  const logout = useCallback(async () => { setToken(null); await store.del("tol_token"); setUser(null); setUnread(0); }, []);
  useEffect(() => { setUnauthorizedHandler(logout); }, [logout]);

  useEffect(() => {
    (async () => {
      try {
        await loadBase();
        const t = await store.get("tol_token");
        if (t) { setToken(t); setUser(await get("/me")); }
      } catch { setToken(null); } finally { setBooting(false); }
    })();
  }, []);

  useEffect(() => {
    if (!user) return undefined;
    let alive = true;
    const load = () => get("/notifications").then((n) => alive && setUnread(n.filter((x) => !x.read).length)).catch(() => {});
    load();
    const t = setInterval(load, 10000);
    return () => { alive = false; clearInterval(t); };
  }, [user]);

  const enter = async (r) => { setToken(r.token); await store.set("tol_token", r.token); setUser(await get("/me")); };
  const login = async (email, password) => enter(await post("/auth/login", { email, password }));
  const register = async (body) => enter(await post("/auth/register", body));
  const refreshMe = async () => setUser(await get("/me"));

  return <Ctx.Provider value={{ user, booting, login, register, logout, refreshMe, unread, setUnread }}>{children}</Ctx.Provider>;
}
