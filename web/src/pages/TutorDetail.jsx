import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { get, post, cop, dayKey, fmtDay, fmtTime, fmtDb, MODALITY } from "../api.js";
import { ErrorBox, Field, Modal, Spinner, Stars, useAction, useLoad } from "../ui.jsx";

export default function TutorDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { data: t, error, loading, reload } = useLoad(() => get(`/tutors/${id}`), [id]);
  const [slot, setSlot] = useState(null);
  const [f, setF] = useState({ subject: "", topic: "", modality: "virtual", card: "4242 4242 4242 4242" });
  const { busy, error: bookErr, run, setError } = useAction();

  if (loading && !t) return <Spinner />;
  if (error) return <><ErrorBox error={error} /><button className="btn ghost" onClick={() => nav("/")}>Volver</button></>;

  const byDay = {};
  t.slots.forEach((s) => { (byDay[dayKey(s)] ||= []).push(s); });
  const open = (s) => { setSlot(s); setError(null); setF((x) => ({ ...x, subject: t.subjects[0], modality: t.modality === "presencial" ? "presencial" : "virtual" })); };
  const pay = () => run(async () => {
    try {
      await post("/bookings", { tutorId: t.id, subject: f.subject, topic: f.topic, startAt: slot, modality: f.modality, cardNumber: f.card });
      nav("/mis-tutorias");
    } catch (e) { if (e.status === 409) reload(true); throw e; }
  });

  return (
    <>
      <div className="card stack">
        <div className="row between"><h1 style={{ margin: 0 }}>{t.name}</h1>{t.online && <span className="online">● En línea ahora</span>}</div>
        <Stars value={t.ratingAvg} count={t.ratingCount} />
        <div>{t.subjects.map((s) => <span className="tag" key={s}>{s}</span>)}</div>
        <p>{t.bio}</p>
        <small className="muted">🎓 {t.education || "—"} · 📍 {t.city} · {MODALITY[t.modality]} · Niveles: {t.levels.join(", ") || "—"}</small>
        <div className="price">{cop(t.pricePerHour)} por hora</div>
      </div>

      <div className="card">
        <h2>Horarios disponibles (próximos 7 días)</h2>
        {Object.keys(byDay).length === 0 && <p className="muted">Este tutor no tiene horarios libres próximamente.</p>}
        {Object.entries(byDay).map(([d, list]) => (
          <div key={d}><b className="cap">{fmtDay(list[0])}</b>
            <div className="slots">{list.map((s) => <button key={s} className="slot" onClick={() => open(s)}>{fmtTime(s)}</button>)}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <h2>Reseñas</h2>
        {t.reviews.length === 0 && <p className="muted">Aún no tiene reseñas.</p>}
        {t.reviews.map((r, i) => (
          <div key={i} style={{ borderBottom: "1px solid var(--line)", padding: ".5rem 0" }}>
            <Stars value={r.score} /> <b>{r.student}</b> <small className="muted">{fmtDb(r.created_at)}</small>
            <div>{r.comment}</div>
          </div>
        ))}
      </div>

      {slot && (
        <Modal title="Confirmar reserva" onClose={() => setSlot(null)}>
          <div className="stack">
            <div className="alert info"><b>{fmtDay(slot)}</b>, {fmtTime(slot)} · 1 hora · <b>{cop(t.pricePerHour)}</b></div>
            <Field label="Materia"><select value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })}>{t.subjects.map((s) => <option key={s}>{s}</option>)}</select></Field>
            <Field label="Tema a trabajar"><input value={f.topic} onChange={(e) => setF({ ...f, topic: e.target.value })} placeholder="Ej: Listas y diccionarios" /></Field>
            {t.modality === "ambas" && <Field label="Modalidad"><select value={f.modality} onChange={(e) => setF({ ...f, modality: e.target.value })}><option value="virtual">Virtual</option><option value="presencial">Presencial</option></select></Field>}
            <Field label="Tarjeta (simulada)" hint="4242 4242 4242 4242 aprueba el pago · una tarjeta que termine en 0002 lo rechaza"><input value={f.card} onChange={(e) => setF({ ...f, card: e.target.value })} inputMode="numeric" /></Field>
            <ErrorBox error={bookErr} />
            <button className="btn green" disabled={busy} onClick={pay}>{busy ? "Procesando pago…" : `Pagar ${cop(t.pricePerHour)} y reservar`}</button>
          </div>
        </Modal>
      )}
    </>
  );
}
