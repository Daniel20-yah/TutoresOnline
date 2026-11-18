import { useState } from "react";
import { get, put, cop } from "../api.js";
import { useAuth } from "../auth.jsx";
import { ErrorBox, Field, Ok, useAction, useLoad } from "../ui.jsx";

export default function TutorProfile() {
  const { user, refreshMe } = useAuth();
  const p = user.profile;
  const [f, setF] = useState({ subjects: p.subjects.join(", "), levels: p.levels.join(", "), modality: p.modality, pricePerHour: p.pricePerHour, city: p.city, education: p.education, bio: p.bio });
  const [ok, setOk] = useState("");
  const { busy, error, run } = useAction();
  const { data: earn } = useLoad(() => get("/tutor/earnings"), []);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const list = (s) => s.split(",").map((x) => x.trim()).filter(Boolean);
  const save = (e) => { e.preventDefault(); run(async () => { setOk(""); await put("/tutor/profile", { ...f, subjects: list(f.subjects), levels: list(f.levels), pricePerHour: Number(f.pricePerHour) }); await refreshMe(); setOk("Perfil actualizado."); }); };

  return (
    <>
      <h1>Perfil e ingresos</h1>
      {earn && (
        <div className="grid" style={{ marginBottom: "1rem" }}>
          <div className="stat"><small className="muted">Tutorías completadas</small><b>{earn.sessions}</b></div>
          <div className="stat"><small className="muted">Ingresos brutos</small><b>{cop(earn.gross)}</b></div>
          <div className="stat"><small className="muted">Comisión plataforma (15%)</small><b>{cop(earn.commission)}</b></div>
          <div className="stat"><small className="muted">Neto para ti</small><b style={{ color: "var(--green)" }}>{cop(earn.net)}</b></div>
        </div>
      )}
      {p.verified === 2 && <div className="alert error">Perfil rechazado. Al guardar cambios, contacta al administrador para una nueva revisión.</div>}
      <form className="card stack" onSubmit={save}>
        <Field label="Materias (separadas por coma)"><input required value={f.subjects} onChange={set("subjects")} /></Field>
        <Field label="Niveles"><input value={f.levels} onChange={set("levels")} /></Field>
        <div className="row">
          <Field label="Modalidad"><select value={f.modality} onChange={set("modality")}><option value="ambas">Virtual y presencial</option><option value="virtual">Virtual</option><option value="presencial">Presencial</option></select></Field>
          <Field label="Precio por hora (COP)"><input type="number" min="5000" step="1000" value={f.pricePerHour} onChange={set("pricePerHour")} /></Field>
          <Field label="Ciudad"><input value={f.city} onChange={set("city")} /></Field>
        </div>
        <Field label="Formación académica"><input value={f.education} onChange={set("education")} /></Field>
        <Field label="Presentación"><textarea rows={3} value={f.bio} onChange={set("bio")} /></Field>
        <ErrorBox error={error} /><Ok text={ok} />
        <button className="btn" disabled={busy}>Guardar cambios</button>
      </form>
    </>
  );
}
