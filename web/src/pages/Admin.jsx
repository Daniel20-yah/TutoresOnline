import { useState } from "react";
import { get, post, del, cop, fmtDb } from "../api.js";
import { ErrorBox, Modal, Field, Spinner, Stars, useAction, useLoad } from "../ui.jsx";

const STATUS_LABEL = { buscando: "Buscando", pendiente: "Pendientes", confirmada: "Confirmadas", en_curso: "En curso", finalizada: "Finalizadas", calificada: "Calificadas", rechazada: "Rechazadas", cancelada: "Canceladas", sin_tutor: "Sin tutor" };

function Stats() {
  const { data: s, error, loading } = useLoad(() => get("/admin/stats"), [], 15000);
  if (loading && !s) return <Spinner />;
  if (error) return <ErrorBox error={error} />;
  const max = Math.max(1, ...Object.values(s.bookingsByStatus));
  const maxSub = Math.max(1, ...s.topSubjects.map((x) => x.c));
  return (
    <>
      <div className="grid">
        <div className="stat"><small className="muted">Estudiantes</small><b>{s.users.student || 0}</b></div>
        <div className="stat"><small className="muted">Tutores</small><b>{s.users.tutor || 0}</b></div>
        <div className="stat"><small className="muted">Tutores por verificar</small><b style={{ color: "var(--orange)" }}>{s.pendingTutors}</b></div>
        <div className="stat"><small className="muted">Tutorías realizadas</small><b>{s.sessionsCompleted}</b></div>
        <div className="stat"><small className="muted">Volumen transado</small><b>{cop(s.grossVolume)}</b></div>
        <div className="stat"><small className="muted">Ingresos plataforma (15%)</small><b style={{ color: "var(--green)" }}>{cop(s.platformRevenue)}</b></div>
        <div className="stat"><small className="muted">Calificación promedio</small><b>{s.averageRating || "—"} ★</b></div>
      </div>
      <div className="grid" style={{ marginTop: "1rem" }}>
        <div className="card"><h3>Reservas por estado</h3>
          {Object.entries(s.bookingsByStatus).map(([k, v]) => <div key={k} style={{ margin: ".4rem 0" }}><div className="row between"><small>{STATUS_LABEL[k] || k}</small><small>{v}</small></div><div className="bar"><i style={{ width: `${(v / max) * 100}%` }} /></div></div>)}
        </div>
        <div className="card"><h3>Materias más solicitadas</h3>
          {s.topSubjects.map((x) => <div key={x.subject} style={{ margin: ".4rem 0" }}><div className="row between"><small>{x.subject}</small><small>{x.c}</small></div><div className="bar"><i style={{ width: `${(x.c / maxSub) * 100}%`, background: "var(--green)" }} /></div></div>)}
        </div>
      </div>
    </>
  );
}

function Tutors() {
  const [filter, setFilter] = useState("0");
  const { data, error, loading, reload } = useLoad(() => get(filter === "all" ? "/admin/tutors" : `/admin/tutors?status=${filter}`), [filter]);
  const { busy, error: actErr, run } = useAction();
  const [rej, setRej] = useState(null);
  const [reason, setReason] = useState("");
  const verify = (t, approve, why) => run(async () => { await post(`/admin/tutors/${t.id}/verify`, { approve, reason: why }); setRej(null); setReason(""); reload(true); });
  const label = ["Pendiente", "Aprobado", "Rechazado"];
  return (
    <>
      <div className="tabs">{[["0", "Pendientes"], ["1", "Aprobados"], ["2", "Rechazados"], ["all", "Todos"]].map(([v, l]) => <button key={v} className={filter === v ? "on" : ""} onClick={() => setFilter(v)}>{l}</button>)}</div>
      <ErrorBox error={error || actErr} />
      {loading && !data ? <Spinner /> : data?.length === 0 ? <div className="card center muted">Sin resultados.</div> : data?.map((t) => (
        <div className="card row between" key={t.id}>
          <div><b>{t.name}</b> <span className="chip gray">{label[t.verified]}</span><div className="muted">{t.email} · {t.education || "sin formación"} · {cop(t.pricePerHour)}/h</div><div>{t.subjects.map((s) => <span className="tag" key={s}>{s}</span>)}</div></div>
          <div className="row">
            {t.verified !== 1 && <button className="btn green sm" disabled={busy} onClick={() => verify(t, true)}>Aprobar</button>}
            {t.verified !== 2 && <button className="btn red sm" disabled={busy} onClick={() => { setRej(t); setReason(""); }}>Rechazar</button>}
          </div>
        </div>
      ))}
      {rej && <Modal title={`Rechazar a ${rej.name}`} onClose={() => setRej(null)}><div className="stack">
        <Field label="Motivo (obligatorio)"><input value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
        <button className="btn red" disabled={busy || !reason.trim()} onClick={() => verify(rej, false, reason)}>Confirmar rechazo</button></div></Modal>}
    </>
  );
}

function Ratings() {
  const { data, error, loading, reload } = useLoad(() => get("/admin/ratings"), []);
  const { run, error: actErr } = useAction();
  if (loading && !data) return <Spinner />;
  return (<><ErrorBox error={error || actErr} />
    {data?.map((r) => <div className="card row between" key={r.id}><div><Stars value={r.score} /> <b>{r.student}</b> → {r.tutor} <small className="muted">{fmtDb(r.createdAt)}</small><div>{r.comment || <i className="muted">sin comentario</i>}</div></div>
      <button className="btn ghost sm" onClick={() => run(async () => { await del(`/admin/ratings/${r.id}`); reload(true); })}>Eliminar</button></div>)}</>);
}

function Users() {
  const { data, error, loading, reload } = useLoad(() => get("/admin/users"), []);
  const { run, error: actErr } = useAction();
  if (loading && !data) return <Spinner />;
  return (<><ErrorBox error={error || actErr} />
    <div className="card" style={{ overflowX: "auto" }}><table><thead><tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Estado</th><th /></tr></thead><tbody>
      {data?.map((u) => <tr key={u.id}><td>{u.name}</td><td>{u.email}</td><td>{u.role}</td><td>{u.active ? "Activo" : "Suspendido"}</td>
        <td>{u.role !== "admin" && <button className="btn ghost sm" onClick={() => run(async () => { await post(`/admin/users/${u.id}/active`, { active: !u.active }); reload(true); })}>{u.active ? "Suspender" : "Activar"}</button>}</td></tr>)}
    </tbody></table></div></>);
}

export default function Admin() {
  const [tab, setTab] = useState("stats");
  const tabs = [["stats", "Estadísticas"], ["tutors", "Verificar tutores"], ["ratings", "Calificaciones"], ["users", "Usuarios"]];
  return (
    <>
      <h1>Panel de administración</h1>
      <div className="tabs">{tabs.map(([v, l]) => <button key={v} className={tab === v ? "on" : ""} onClick={() => setTab(v)}>{l}</button>)}</div>
      {tab === "stats" && <Stats />}{tab === "tutors" && <Tutors />}{tab === "ratings" && <Ratings />}{tab === "users" && <Users />}
    </>
  );
}
