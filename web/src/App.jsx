import { Link, NavLink, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { useAuth } from "./auth.jsx";
import { Spinner } from "./ui.jsx";
import { Login, Register } from "./pages/Auth.jsx";
import Search from "./pages/Search.jsx";
import TutorDetail from "./pages/TutorDetail.jsx";
import OnDemand from "./pages/OnDemand.jsx";
import MyBookings from "./pages/MyBookings.jsx";
import Notifications from "./pages/Notifications.jsx";
import TutorPanel from "./pages/TutorPanel.jsx";
import Availability from "./pages/Availability.jsx";
import TutorProfile from "./pages/TutorProfile.jsx";
import Admin from "./pages/Admin.jsx";

const NAV = {
  student: [["/", "Buscar tutores"], ["/inmediata", "Tutoría inmediata"], ["/mis-tutorias", "Mis tutorías"]],
  tutor: [["/panel", "Solicitudes"], ["/mis-tutorias", "Mis tutorías"], ["/disponibilidad", "Disponibilidad"], ["/perfil", "Perfil e ingresos"]],
  admin: [["/admin", "Administración"]],
};
const HOME = { student: "/", tutor: "/panel", admin: "/admin" };

function Protected({ roles, children }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to={HOME[user.role]} replace />;
  return children;
}

function Header() {
  const { user, logout, unread } = useAuth();
  const nav = useNavigate();
  return (
    <header className="top"><div className="in">
      <Link to={user ? HOME[user.role] : "/login"} className="brand">🎓 TutoresOn-Line</Link>
      {user && <nav>{NAV[user.role].map(([to, l]) => <NavLink key={to} to={to} end={to === "/"}>{l}</NavLink>)}</nav>}
      {user && (
        <div className="row">
          <Link to="/notificaciones" className="bell" aria-label="Notificaciones">🔔{unread > 0 && <b>{unread}</b>}</Link>
          <small>{user.name.split(" ")[0]}</small>
          <button className="btn ghost sm" style={{ color: "#fff", borderColor: "rgba(255,255,255,.4)" }} onClick={() => { logout(); nav("/login"); }}>Salir</button>
        </div>
      )}
    </div></header>
  );
}

export default function App() {
  const { user, loading } = useAuth();
  if (loading) return <Spinner text="Iniciando…" />;
  return (
    <>
      <Header />
      <main className="container">
        <Routes>
          <Route path="/login" element={user ? <Navigate to={HOME[user.role]} replace /> : <Login />} />
          <Route path="/registro" element={user ? <Navigate to={HOME[user.role]} replace /> : <Register />} />
          <Route path="/" element={<Protected roles={["student"]}><Search /></Protected>} />
          <Route path="/tutor/:id" element={<Protected roles={["student"]}><TutorDetail /></Protected>} />
          <Route path="/inmediata" element={<Protected roles={["student"]}><OnDemand /></Protected>} />
          <Route path="/mis-tutorias" element={<Protected roles={["student", "tutor"]}><MyBookings /></Protected>} />
          <Route path="/notificaciones" element={<Protected><Notifications /></Protected>} />
          <Route path="/panel" element={<Protected roles={["tutor"]}><TutorPanel /></Protected>} />
          <Route path="/disponibilidad" element={<Protected roles={["tutor"]}><Availability /></Protected>} />
          <Route path="/perfil" element={<Protected roles={["tutor"]}><TutorProfile /></Protected>} />
          <Route path="/admin" element={<Protected roles={["admin"]}><Admin /></Protected>} />
          <Route path="*" element={<div className="card center"><h2>404</h2><p>Esta página no existe.</p><Link to="/">Volver al inicio</Link></div>} />
        </Routes>
      </main>
    </>
  );
}
