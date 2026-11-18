import { useEffect } from "react";
import { get, post, fmtDb } from "../api.js";
import { useAuth } from "../auth.jsx";
import { ErrorBox, Spinner, useLoad } from "../ui.jsx";

export default function Notifications() {
  const { setUnread } = useAuth();
  const { data, error, loading } = useLoad(() => get("/notifications"), [], 10000);
  useEffect(() => { post("/notifications/read").then(() => setUnread(0)).catch(() => {}); }, [setUnread]);
  if (loading && !data) return <Spinner />;
  return (
    <>
      <h1>Notificaciones</h1>
      <ErrorBox error={error} />
      {data?.length === 0 && <div className="card center muted">No tienes notificaciones.</div>}
      {data?.map((n) => (
        <div className="card" key={n.id} style={n.read ? undefined : { borderLeft: "4px solid var(--blue2)" }}>
          <b>{n.title}</b><div>{n.body}</div><small className="muted">{fmtDb(n.createdAt)}</small>
        </div>
      ))}
    </>
  );
}
