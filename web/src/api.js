const BASE = (import.meta.env.VITE_API_URL || "/api").replace(/\/$/, "");
const KEY = "tol_token";

export const tokenStore = {
  get() { try { return localStorage.getItem(KEY); } catch { return null; } },
  set(t) { try { localStorage.setItem(KEY, t); } catch { /* sin storage */ } },
  clear() { try { localStorage.removeItem(KEY); } catch { /* sin storage */ } },
};

let onUnauthorized = () => {};
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn; };

export class ApiError extends Error {
  constructor(message, status, data) { super(message); this.status = status; this.data = data; }
}

export async function api(method, path, body) {
  const token = tokenStore.get();
  let res;
  try {
    res = await fetch(BASE + path, {
      method,
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError("No se pudo conectar con el servidor", 0, {});
  }
  let data = {};
  try { data = await res.json(); } catch { /* sin cuerpo */ }
  if (res.status === 401 && token && !path.startsWith("/auth/")) onUnauthorized();
  if (!res.ok) throw new ApiError(data.error || `Error ${res.status}`, res.status, data);
  return data;
}
export const get = (p) => api("GET", p);
export const post = (p, b) => api("POST", p, b ?? {});
export const put = (p, b) => api("PUT", p, b);
export const del = (p) => api("DELETE", p);

// ------------------------------------------------------------ formato
const TZ = "America/Bogota";
export const cop = (n) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n || 0);
export const fmtDateTime = (iso) => iso ? new Intl.DateTimeFormat("es-CO", { timeZone: TZ, dateStyle: "medium", timeStyle: "short" }).format(new Date(iso)) : "—";
export const fmtDay = (iso) => new Intl.DateTimeFormat("es-CO", { timeZone: TZ, weekday: "long", day: "numeric", month: "short" }).format(new Date(iso));
export const fmtTime = (iso) => new Intl.DateTimeFormat("es-CO", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: true }).format(new Date(iso));
export const dayKey = (iso) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(iso));
// created_at de SQLite llega como "YYYY-MM-DD HH:MM:SS" en UTC
export const fmtDb = (s) => s ? fmtDateTime(s.includes("T") ? s : s.replace(" ", "T") + "Z") : "—";

export const STATUS = {
  buscando: ["Buscando tutor", "blue"], pendiente: ["Esperando tutor", "orange"], confirmada: ["Confirmada", "green"],
  en_curso: ["En curso", "blue"], finalizada: ["Finalizada", "gray"], calificada: ["Calificada", "gray"],
  rechazada: ["Rechazada", "red"], cancelada: ["Cancelada", "red"], sin_tutor: ["Sin tutor", "red"],
};
export const MODALITY = { virtual: "Virtual", presencial: "Presencial", ambas: "Virtual y presencial" };
export const WEEKDAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
