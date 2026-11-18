import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth.jsx";
import { ErrorBox, Field, useAction } from "../ui.jsx";

const DEMO = [
  ["Estudiante", "estudiante@demo.co"], ["Tutor (Laura)", "laura@demo.co"], ["Tutor (Carlos)", "carlos@demo.co"], ["Administrador", "admin@tutoresonline.co"],
];

export function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { busy, error, run } = useAction();
  return (
    <div className="auth">
      <div className="hero"><h1>TutoresOn-Line</h1><p>Encuentra tutores verificados o recibe ayuda inmediata.</p></div>
      <form className="card stack" onSubmit={(e) => { e.preventDefault(); run(() => login(email, password)); }}>
        <h2>Iniciar sesión</h2>
        <Field label="Correo"><input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" /></Field>
        <Field label="Contraseña"><input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" /></Field>
        <ErrorBox error={error} />
        <button className="btn" disabled={busy}>{busy ? "Entrando…" : "Entrar"}</button>
        <small>¿No tienes cuenta? <Link to="/registro">Regístrate</Link></small>
      </form>
      <div className="card">
        <b>Cuentas de demostración</b> <small className="muted">(clave: demo1234)</small>
        <div className="row" style={{ marginTop: ".5rem" }}>
          {DEMO.map(([l, e]) => <button key={e} className="btn ghost sm" type="button" onClick={() => { setEmail(e); setPassword("demo1234"); }}>{l}</button>)}
        </div>
      </div>
    </div>
  );
}

export function Register() {
  const { register } = useAuth();
  const [f, setF] = useState({ role: "student", name: "", email: "", password: "", subjects: "", levels: "", modality: "ambas", pricePerHour: 30000, city: "Barranquilla", education: "", bio: "" });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const { busy, error, run } = useAction();
  const submit = (e) => {
    e.preventDefault();
    const body = { name: f.name, email: f.email, password: f.password, role: f.role };
    if (f.role === "tutor") {
      body.tutor = {
        subjects: f.subjects.split(",").map((s) => s.trim()).filter(Boolean), levels: f.levels.split(",").map((s) => s.trim()).filter(Boolean),
        modality: f.modality, pricePerHour: Number(f.pricePerHour), city: f.city, education: f.education, bio: f.bio,
      };
    }
    run(() => register(body));
  };
  return (
    <div className="auth">
      <form className="card stack" onSubmit={submit}>
        <h2>Crear cuenta</h2>
        <div className="tabs">
          {[["student", "Soy estudiante"], ["tutor", "Soy tutor"]].map(([v, l]) => <button type="button" key={v} className={f.role === v ? "on" : ""} onClick={() => setF({ ...f, role: v })}>{l}</button>)}
        </div>
        <Field label="Nombre completo"><input required value={f.name} onChange={set("name")} /></Field>
        <Field label="Correo"><input type="email" required value={f.email} onChange={set("email")} /></Field>
        <Field label="Contraseña" hint="Mínimo 6 caracteres"><input type="password" required minLength={6} value={f.password} onChange={set("password")} /></Field>
        {f.role === "tutor" && (<>
          <div className="alert info">Tu perfil será revisado por el administrador antes de aparecer en las búsquedas.</div>
          <Field label="Materias" hint="Separadas por coma. Ej: Python, Cálculo"><input required value={f.subjects} onChange={set("subjects")} /></Field>
          <Field label="Niveles" hint="Ej: Bachillerato, Universitario"><input value={f.levels} onChange={set("levels")} /></Field>
          <div className="row">
            <Field label="Modalidad"><select value={f.modality} onChange={set("modality")}><option value="ambas">Virtual y presencial</option><option value="virtual">Virtual</option><option value="presencial">Presencial</option></select></Field>
            <Field label="Precio por hora (COP)"><input type="number" min="5000" step="1000" value={f.pricePerHour} onChange={set("pricePerHour")} /></Field>
          </div>
          <Field label="Ciudad"><input value={f.city} onChange={set("city")} /></Field>
          <Field label="Formación académica"><input value={f.education} onChange={set("education")} /></Field>
          <Field label="Presentación"><textarea rows={3} value={f.bio} onChange={set("bio")} /></Field>
        </>)}
        <ErrorBox error={error} />
        <button className="btn" disabled={busy}>{busy ? "Creando…" : "Crear cuenta"}</button>
        <small>¿Ya tienes cuenta? <Link to="/login">Inicia sesión</Link></small>
      </form>
    </div>
  );
}
