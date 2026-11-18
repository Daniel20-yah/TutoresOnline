import { useState } from "react";
import { get, post, cop, fmtDateTime, MODALITY } from "../api.js";
import { useAuth } from "../auth.jsx";
import { Chip, ErrorBox, Field, Modal, Spinner, Stars, useAction, useLoad } from "../ui.jsx";

export default function MyBookings() {
  const { user } = useAuth();
  const isTutor = user.role === "tutor";
  const { data, error, loading, reload } = useLoad(() => get("/bookings"), [], 6000);
  const { busy, error: actErr, run } = useAction();
  const [rating, setRating] = useState(null);
  const [score, setScore] = useState(5);
  const [comment, setComment] = useState("");
  const rate = useAction();

  const act = (b, path) => run(async () => { await post(`/bookings/${b.id}/${path}`); await reload(true); });
  const submitRate = () => rate.run(async () => {
    await post(`/bookings/${rating.id}/rate`, { score, comment });
    setRating(null); setComment(""); setScore(5); reload(true);
  });

  if (loading && !data) return <Spinner />;
  return (
    <>
      <h1>Mis tutorías</h1>
      <ErrorBox error={error || actErr} />
      {data?.length === 0 && <div className="card center muted">Todavía no tienes tutorías.</div>}
      {data?.map((b) => (
        <div className="card stack" key={b.id}>
          <div className="row between"><h3 style={{ margin: 0 }}>{b.subject} <small className="muted">#{b.id}</small></h3><Chip status={b.status} /></div>
          <div className="muted">
            {isTutor ? <>Estudiante: <b>{b.student.name}</b></> : <>Tutor: <b>{b.tutor?.name || "Buscando…"}</b></>}
            {" · "}{b.type === "bajo_demanda" ? "Inmediata" : "Programada"} · {MODALITY[b.modality]}
            {b.startAt && <> · {fmtDateTime(b.startAt)}</>} · {cop(b.price)} · Pago: {b.paymentStatus}
          </div>
          {b.topic && <div>📝 {b.topic}</div>}
          <div className="row">
            {["confirmada", "en_curso"].includes(b.status) && b.meetingLink && <a className="btn green sm" href={b.meetingLink} target="_blank" rel="noreferrer">Entrar a la videollamada</a>}
            {b.status === "confirmada" && <button className="btn sm" disabled={busy} onClick={() => act(b, "start")}>Iniciar sesión</button>}
            {isTutor && b.status === "en_curso" && <button className="btn orange sm" disabled={busy} onClick={() => act(b, "finish")}>Finalizar tutoría</button>}
            {!isTutor && ["pendiente", "confirmada", "buscando", "sin_tutor"].includes(b.status) && <button className="btn ghost sm" disabled={busy} onClick={() => act(b, "cancel")}>Cancelar</button>}
            {!isTutor && b.status === "finalizada" && !b.rated && <button className="btn sm" onClick={() => { setRating(b); rate.setError(null); }}>Calificar</button>}
          </div>
        </div>
      ))}
      {rating && (
        <Modal title={`Califica a ${rating.tutor?.name}`} onClose={() => setRating(null)}>
          <div className="stack">
            <div className="center" style={{ padding: ".3rem" }}><Stars value={score} onChange={setScore} /></div>
            <Field label="Comentario (opcional)"><textarea rows={3} value={comment} onChange={(e) => setComment(e.target.value)} /></Field>
            <ErrorBox error={rate.error} />
            <button className="btn green" disabled={rate.busy} onClick={submitRate}>Enviar calificación</button>
          </div>
        </Modal>
      )}
    </>
  );
}
