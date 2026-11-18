import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { get, cop, MODALITY } from "../api.js";
import { ErrorBox, Field, Spinner, Stars, useLoad } from "../ui.jsx";

export default function Search() {
  const [f, setF] = useState({ q: "", modality: "todas", maxPrice: "", minRating: "", onlineOnly: false });
  const [applied, setApplied] = useState(f);
  const qs = new URLSearchParams();
  if (applied.q) qs.set("q", applied.q);
  if (applied.modality !== "todas") qs.set("modality", applied.modality);
  if (applied.maxPrice) qs.set("maxPrice", applied.maxPrice);
  if (applied.minRating) qs.set("minRating", applied.minRating);
  if (applied.onlineOnly) qs.set("onlineOnly", "1");
  const { data, error, loading } = useLoad(() => get("/tutors?" + qs), [JSON.stringify(applied)]);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  useEffect(() => { const t = setTimeout(() => setApplied(f), 300); return () => clearTimeout(t); }, [f]);

  return (
    <>
      <h1>Encuentra tu tutor</h1>
      <div className="card filters">
        <Field label="Materia o nombre"><input placeholder="Ej: Python, cálculo…" value={f.q} onChange={set("q")} /></Field>
        <Field label="Modalidad"><select value={f.modality} onChange={set("modality")}><option value="todas">Todas</option><option value="virtual">Virtual</option><option value="presencial">Presencial</option></select></Field>
        <Field label="Precio máx. por hora"><input type="number" step="1000" placeholder="Sin límite" value={f.maxPrice} onChange={set("maxPrice")} /></Field>
        <Field label="Calificación mínima"><select value={f.minRating} onChange={set("minRating")}><option value="">Cualquiera</option><option value="3">3★ o más</option><option value="4">4★ o más</option><option value="4.5">4.5★ o más</option></select></Field>
        <label className="row"><input type="checkbox" checked={f.onlineOnly} onChange={set("onlineOnly")} /> Solo en línea ahora</label>
      </div>
      <ErrorBox error={error} />
      {loading && !data ? <Spinner /> : data && data.length === 0 ? (
        <div className="card center"><p>No encontramos tutores con esos filtros.</p><p className="muted">Prueba ampliando los criterios de búsqueda.</p></div>
      ) : (
        <div className="grid">
          {(data || []).map((t) => (
            <Link key={t.id} to={`/tutor/${t.id}`} className="card stack" style={{ color: "inherit", textDecoration: "none" }}>
              <div className="row between"><h3 style={{ margin: 0 }}>{t.name}</h3>{t.online && <span className="online">● En línea</span>}</div>
              <Stars value={t.ratingAvg} count={t.ratingCount} />
              <div>{t.subjects.map((s) => <span className="tag" key={s}>{s}</span>)}</div>
              <small className="muted">{t.bio}</small>
              <div className="row between"><span className="price">{cop(t.pricePerHour)}/h</span><small className="muted">{MODALITY[t.modality]} · {t.city}</small></div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
