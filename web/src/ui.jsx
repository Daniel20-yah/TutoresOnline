import { useCallback, useEffect, useRef, useState } from "react";
import { STATUS } from "./api.js";

export function Spinner({ text = "Cargando…" }) {
  return <div className="center muted" role="status"><span className="spin" /> {text}</div>;
}
export const ErrorBox = ({ error }) => error ? <div className="alert error" role="alert">{error.message || String(error)}</div> : null;
export const Ok = ({ text }) => text ? <div className="alert ok" role="status">{text}</div> : null;

export function Chip({ status }) {
  const [label, color] = STATUS[status] || [status, "gray"];
  return <span className={`chip ${color}`}>{label}</span>;
}

export function Stars({ value = 0, count, onChange }) {
  const v = Math.round(value);
  return (
    <span className="stars" aria-label={`${value} de 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={i <= v ? "on" : ""} onClick={onChange ? () => onChange(i) : undefined}
          style={onChange ? { cursor: "pointer", fontSize: 28 } : undefined} role={onChange ? "button" : undefined}
          aria-label={onChange ? `${i} estrellas` : undefined}>★</span>
      ))}
      {count !== undefined && <small className="muted"> {value ? Number(value).toFixed(1) : "Nuevo"} ({count})</small>}
    </span>
  );
}

export function Modal({ title, onClose, children }) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="row between"><h3>{title}</h3><button className="btn ghost" onClick={onClose} aria-label="Cerrar">✕</button></div>
        {children}
      </div>
    </div>
  );
}

/** Carga datos con estado de carga/error y refresco opcional (polling). */
export function useLoad(fn, deps = [], pollMs = 0) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const reload = useCallback(async (silent) => {
    if (!silent) setLoading(true);
    try { setData(await fnRef.current()); setError(null); } catch (e) { setError(e); }
    setLoading(false);
  }, []);
  useEffect(() => { reload(false); }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!pollMs) return undefined;
    const t = setInterval(() => reload(true), pollMs);
    return () => clearInterval(t);
  }, [pollMs, reload]);
  return { data, error, loading, reload, setData };
}

export function Field({ label, children, hint }) {
  return <label className="field"><span>{label}</span>{children}{hint && <small className="muted">{hint}</small>}</label>;
}

/** Ejecuta una acción async mostrando error. */
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const run = async (fn) => {
    setBusy(true); setError(null);
    try { return await fn(); } catch (e) { setError(e); return undefined; } finally { setBusy(false); }
  };
  return { busy, error, run, setError };
}
