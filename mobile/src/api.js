import { DEFAULT_API, store } from "./config";

let base = DEFAULT_API;
let token = null;
let onUnauthorized = () => {};

export const setBase = (u) => { base = String(u || DEFAULT_API).trim().replace(/\/$/, "").replace(/\/api$/, ""); return base; };
export const getBase = () => base;
export const setToken = (t) => { token = t; };
export const setUnauthorizedHandler = (f) => { onUnauthorized = f; };
export const loadBase = async () => { const s = await store.get("tol_base"); if (s) setBase(s); return base; };
export const saveBase = async (u) => { const b = setBase(u); await store.set("tol_base", b); return b; };

export class ApiError extends Error {
  constructor(m, status, data) { super(m); this.status = status; this.data = data; }
}

async function api(method, path, body) {
  let res;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 20000);
  try {
    res = await fetch(`${base}/api${path}`, {
      method, signal: ctl.signal,
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(`No se pudo conectar con el servidor (${base}). Revisa tu internet o la URL del servidor.`, 0, {});
  } finally { clearTimeout(timer); }
  let data = {};
  try { data = await res.json(); } catch { /* sin cuerpo */ }
  if (res.status === 401 && token && !path.startsWith("/auth/")) onUnauthorized();
  if (!res.ok) throw new ApiError(data.error || `Error ${res.status}`, res.status, data);
  return data;
}
export const get = (p) => api("GET", p);
export const post = (p, b) => api("POST", p, b ?? {});
export const put = (p, b) => api("PUT", p, b);

const TZ = "America/Bogota";
const fmt = (iso, o) => { try { return new Intl.DateTimeFormat("es-CO", { timeZone: TZ, ...o }).format(new Date(iso)); } catch { return iso; } };
export const cop = (n) => "$ " + Math.round(n || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
export const fmtDateTime = (iso) => (iso ? fmt(iso, { dateStyle: "medium", timeStyle: "short" }) : "—");
export const fmtDay = (iso) => { const s = fmt(iso, { weekday: "long", day: "numeric", month: "short" }); return s.charAt(0).toUpperCase() + s.slice(1); };
export const fmtTime = (iso) => fmt(iso, { hour: "2-digit", minute: "2-digit", hour12: true });
export const dayKey = (iso) => fmt(iso, { year: "numeric", month: "2-digit", day: "2-digit" });
export const fmtDb = (s) => (s ? fmtDateTime(s.includes("T") ? s : s.replace(" ", "T") + "Z") : "—");

export const STATUS = {
  buscando: ["Buscando tutor", "#2E75B6"], pendiente: ["Esperando tutor", "#C55A11"], confirmada: ["Confirmada", "#548235"],
  en_curso: ["En curso", "#2E75B6"], finalizada: ["Finalizada", "#66758a"], calificada: ["Calificada", "#66758a"],
  rechazada: ["Rechazada", "#C00000"], cancelada: ["Cancelada", "#C00000"], sin_tutor: ["Sin tutor", "#C00000"],
};
export const MODALITY = { virtual: "Virtual", presencial: "Presencial", ambas: "Virtual y presencial" };
export const WEEKDAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
