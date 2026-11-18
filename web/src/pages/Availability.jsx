import { useEffect, useState } from "react";
import { get, put, WEEKDAYS } from "../api.js";
import { ErrorBox, Ok, Spinner, useAction, useLoad } from "../ui.jsx";

export default function Availability() {
  const { data, loading } = useLoad(() => get("/tutor/availability"), []);
  const [blocks, setBlocks] = useState([]);
  const [saved, setSaved] = useState("");
  const { busy, error, run } = useAction();
  useEffect(() => { if (data) setBlocks(data); }, [data]);

  const upd = (i, k, v) => setBlocks(blocks.map((b, j) => (j === i ? { ...b, [k]: Number(v) } : b)));
  const save = () => run(async () => { setSaved(""); await put("/tutor/availability", blocks); setSaved("Disponibilidad guardada. Los estudiantes ya ven tus nuevos horarios."); });
  const hours = Array.from({ length: 25 }, (_, h) => h);

  if (loading && !data) return <Spinner />;
  return (
    <>
      <h1>Disponibilidad semanal</h1>
      <p className="muted">Define los bloques en los que puedes dar tutorías programadas (hora de Colombia). Cada hora se ofrece como una franja reservable.</p>
      <div className="card stack">
        {blocks.length === 0 && <p className="muted">Aún no tienes bloques. Agrega el primero.</p>}
        {blocks.map((b, i) => (
          <div className="row" key={i}>
            <select value={b.weekday} onChange={(e) => upd(i, "weekday", e.target.value)}>{WEEKDAYS.map((d, n) => <option key={d} value={n}>{d}</option>)}</select>
            <span>de</span>
            <select value={b.startHour} onChange={(e) => upd(i, "startHour", e.target.value)}>{hours.slice(0, 24).map((h) => <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>)}</select>
            <span>a</span>
            <select value={b.endHour} onChange={(e) => upd(i, "endHour", e.target.value)}>{hours.slice(1).map((h) => <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>)}</select>
            <button className="btn ghost sm" onClick={() => setBlocks(blocks.filter((_, j) => j !== i))}>Quitar</button>
          </div>
        ))}
        <div className="row">
          <button className="btn ghost" onClick={() => setBlocks([...blocks, { weekday: 1, startHour: 14, endHour: 18 }])}>+ Agregar bloque</button>
          <button className="btn green" disabled={busy} onClick={save}>{busy ? "Guardando…" : "Guardar"}</button>
        </div>
        <ErrorBox error={error} />
        <Ok text={saved} />
      </div>
    </>
  );
}
