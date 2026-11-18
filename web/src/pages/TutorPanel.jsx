import { useState } from "react";
import { get, post, cop, fmtDateTime, MODALITY } from "../api.js";
import { useAuth } from "../auth.jsx";
import { ErrorBox, Field, Modal, Spinner, useAction, useLoad } from "../ui.jsx";

export default function TutorPanel() {
  const { user, refreshMe } = useAuth();
  const p = user.profile;
  const { data, error, loading, reload } = useLoad(() => get("/tutor/requests"), [p?.online], 5000);
  const { busy, error: actErr, run, setError } = useAction();
  const [rejecting, setRejecting] = useState(null);
  const [reason, setReason] = useState("");

  const toggle = () => run(async () => { await post("/tutor/online", { online: !p.online }); await refreshMe(); });
  const accept = (b) => run(async () => { try { await post(`/bookings/${b.id}/accept`); } finally { reload(true); } });
  const reject = () => run(async () => { await post(`/bookings/${rejecting.id}/reject`, { reason }); setRejecting(null); setReason(""); reload(true); });

  return (
    <>
      <h1>Solicitudes</h1>
      {p.verified === 0 && <div className="alert info">Tu perfil está en revisión. Aparecerás en las búsquedas cuando el administrador lo apruebe.</div>}
      {p.verified === 2 && <div className="alert error">Tu perfil fue rechazado. Corrígelo en "Perfil e ingresos".</div>}
      <div className="card row between">
        <div><b>Modo "disponible ahora"</b><div className="muted">Recibe solicitudes inmediatas de estudiantes para tus materias.</div></div>
        <button className={`btn ${p.online ? "red" : "green"}`} disabled={busy} onClick={toggle}>{p.online ? "Desactivar (estás en línea)" : "Activar modo en línea"}</button>
      </div>
      <ErrorBox error={actErr} />
      <ErrorBox error={error} />
      {loading && !data ? <Spinner /> : (<>
        <h2>Tutorías inmediatas disponibles</h2>
        {!p.online && <p className="muted">Activa el modo en línea para ver solicitudes inmediatas.</p>}
        {p.online && data?.onDemand.length === 0 && <div className="card muted center">Esperando solicitudes… <span className="spin" /></div>}
        {data?.onDemand.map((b) => (
          <div className="card row between" key={b.id} style={{ borderLeft: "4px solid var(--orange)" }}>
            <div><b>{b.subject}</b> — {b.topic || "sin descripción"}<div className="muted">{b.student.name} · {MODALITY[b.modality]}</div></div>
            <button className="btn orange" disabled={busy} onClick={() => accept(b)}>Aceptar ahora</button>
          </div>
        ))}
        <h2>Reservas por responder</h2>
        {data?.pending.length === 0 && <div className="card muted center">No tienes reservas pendientes.</div>}
        {data?.pending.map((b) => (
          <div className="card row between" key={b.id}>
            <div><b>{b.subject}</b> — {b.topic || "sin tema"}<div className="muted">{b.student.name} · {fmtDateTime(b.startAt)} · {MODALITY[b.modality]} · {cop(b.price)}</div></div>
            <div className="row">
              <button className="btn green" disabled={busy} onClick={() => accept(b)}>Aceptar</button>
              <button className="btn ghost" disabled={busy} onClick={() => { setRejecting(b); setError(null); }}>Rechazar</button>
            </div>
          </div>
        ))}
      </>)}
      {rejecting && (
        <Modal title="Rechazar reserva" onClose={() => setRejecting(null)}>
          <div className="stack">
            <p className="muted">El estudiante será notificado y su pago reembolsado.</p>
            <Field label="Motivo (opcional)"><input value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
            <button className="btn red" disabled={busy} onClick={reject}>Confirmar rechazo</button>
          </div>
        </Modal>
      )}
    </>
  );
}
