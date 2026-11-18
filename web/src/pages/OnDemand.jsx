import { useEffect, useState } from "react";
import { get, post, cop } from "../api.js";
import { Chip, ErrorBox, Field, useAction } from "../ui.jsx";

export default function OnDemand() {
  const [f, setF] = useState({ subject: "", topic: "", modality: "virtual" });
  const [booking, setBooking] = useState(null);
  const [notified, setNotified] = useState(0);
  const { busy, error, run } = useAction();
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  useEffect(() => {
    if (!booking || booking.status !== "buscando") return undefined;
    const t = setInterval(async () => { try { setBooking(await get(`/bookings/${booking.id}`)); } catch { /* reintenta */ } }, 3000);
    return () => clearInterval(t);
  }, [booking?.id, booking?.status]);

  const send = (e) => { e.preventDefault(); run(async () => { const b = await post("/bookings/on-demand", f); setNotified(b.notifiedTutors); setBooking(b); }); };
  const act = (path) => run(async () => setBooking(await post(`/bookings/${booking.id}/${path}`)));

  if (booking) {
    const b = booking;
    return (
      <div className="card stack" style={{ maxWidth: 560, margin: "1rem auto" }}>
        <div className="row between"><h2 style={{ margin: 0 }}>Tutoría inmediata</h2><Chip status={b.status} /></div>
        <div><b>{b.subject}</b>{b.topic && ` — ${b.topic}`}</div>
        {b.status === "buscando" && <div className="alert info"><span className="spin" /> Buscando tutor… avisamos a {notified || "varios"} tutor(es) en línea. El primero que acepte te atenderá.</div>}
        {b.status === "confirmada" && (<>
          <div className="alert ok">¡<b>{b.tutor?.name}</b> aceptó tu solicitud! Valor: {cop(b.price)} (pago aprobado).</div>
          {b.meetingLink ? <a className="btn green" href={b.meetingLink} target="_blank" rel="noreferrer" onClick={() => post(`/bookings/${b.id}/start`).catch(() => {})}>Entrar a la videollamada</a> : <div className="alert info">Coordina el punto de encuentro con tu tutor.</div>}
        </>)}
        {b.status === "sin_tutor" && <div className="alert error">Ningún tutor aceptó a tiempo. Puedes reintentar o reservar una tutoría programada.</div>}
        <ErrorBox error={error} />
        <div className="row">
          {b.status === "sin_tutor" && <button className="btn" disabled={busy} onClick={() => act("retry")}>Reintentar</button>}
          {["buscando", "sin_tutor", "confirmada"].includes(b.status) && <button className="btn ghost" disabled={busy} onClick={() => act("cancel")}>Cancelar solicitud</button>}
          <button className="btn ghost" onClick={() => setBooking(null)}>Nueva solicitud</button>
        </div>
      </div>
    );
  }
  return (
    <form className="card stack" style={{ maxWidth: 560, margin: "1rem auto" }} onSubmit={send}>
      <h1>Tutoría inmediata</h1>
      <p className="muted">Describe lo que necesitas y te conectamos con el primer tutor en línea que pueda ayudarte.</p>
      <Field label="Materia"><input required value={f.subject} onChange={set("subject")} placeholder="Ej: Python" /></Field>
      <Field label="¿En qué necesitas ayuda?"><textarea rows={3} value={f.topic} onChange={set("topic")} /></Field>
      <Field label="Modalidad"><select value={f.modality} onChange={set("modality")}><option value="virtual">Virtual (videollamada)</option><option value="presencial">Presencial</option></select></Field>
      <ErrorBox error={error} />
      <button className="btn orange" disabled={busy}>{busy ? "Enviando…" : "Buscar tutor ahora"}</button>
    </form>
  );
}
