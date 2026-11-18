import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { db, all, get, run, notify } from "./db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-cambiar-en-produccion";
const COMMISSION = 0.15; // comisión de la plataforma
const BOGOTA_OFFSET_H = 5; // UTC-5 sin horario de verano
const PENDING_TTL_H = 24; // plazo de respuesta del tutor (reserva programada)
const SEARCH_TTL_MIN = 5; // plazo de búsqueda bajo demanda
const BANNED = ["idiota", "estupido", "estúpido", "imbecil", "imbécil", "mierda", "hp", "malparido"];

export const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

// ---------------------------------------------------------------- utilidades
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const bad = (res, code, message, extra = {}) => res.status(code).json({ error: message, ...extra });
const parseJSON = (s, d = []) => { try { return JSON.parse(s); } catch { return d; } };
const norm = (s) => String(s || "").trim().toLowerCase();
const nowIso = () => new Date().toISOString();

function sign(user) {
  return jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: "7d" });
}

function auth(...roles) {
  return (req, res, next) => {
    const h = req.headers.authorization || "";
    const token = h.startsWith("Bearer ") ? h.slice(7) : null;
    if (!token) return bad(res, 401, "No autenticado");
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      const user = get("SELECT id,name,email,role,active FROM users WHERE id=?", payload.id);
      if (!user || !user.active) return bad(res, 401, "Cuenta inexistente o suspendida");
      if (roles.length && !roles.includes(user.role)) return bad(res, 403, "No tienes permiso para esta acción");
      req.user = user;
      next();
    } catch {
      return bad(res, 401, "Sesión inválida o vencida");
    }
  };
}

function tutorRow(r) {
  if (!r) return null;
  return {
    id: r.id,
    name: r.name,
    bio: r.bio,
    education: r.education,
    subjects: parseJSON(r.subjects),
    levels: parseJSON(r.levels),
    modality: r.modality,
    pricePerHour: r.price_per_hour,
    city: r.city,
    verified: r.verified,
    online: !!r.online,
    ratingAvg: Math.round(r.rating_avg * 10) / 10,
    ratingCount: r.rating_count,
  };
}

const TUTOR_SELECT = `SELECT u.id,u.name,u.email,p.* FROM users u JOIN tutor_profiles p ON p.user_id=u.id`;

function bookingRow(b) {
  return {
    id: b.id,
    type: b.type,
    subject: b.subject,
    topic: b.topic,
    modality: b.modality,
    startAt: b.start_at,
    durationMin: b.duration_min,
    price: b.price,
    status: b.status,
    paymentStatus: b.payment_status,
    meetingLink: b.meeting_link,
    createdAt: b.created_at,
    student: b.student_name ? { id: b.student_id, name: b.student_name } : { id: b.student_id },
    tutor: b.tutor_id ? { id: b.tutor_id, name: b.tutor_name } : null,
    rated: !!b.rated,
  };
}

const BOOKING_SELECT = `
  SELECT b.*, s.name AS student_name, t.name AS tutor_name,
         (SELECT 1 FROM ratings r WHERE r.booking_id=b.id) AS rated
  FROM bookings b
  JOIN users s ON s.id=b.student_id
  LEFT JOIN users t ON t.id=b.tutor_id`;

function getBooking(id) {
  const b = get(`${BOOKING_SELECT} WHERE b.id=?`, id);
  return b ? bookingRow(b) : null;
}

// Vence solicitudes sin respuesta (flujos de excepción del Corte 1)
function expireStale() {
  const cutoffPending = new Date(Date.now() - PENDING_TTL_H * 3600e3).toISOString().replace("T", " ").slice(0, 19);
  const stale = all("SELECT id,student_id FROM bookings WHERE status='pendiente' AND created_at < ?", cutoffPending);
  for (const b of stale) {
    run("UPDATE bookings SET status='rechazada', payment_status='reembolsado', updated_at=datetime('now') WHERE id=?", b.id);
    notify(b.student_id, "Reserva vencida", "El tutor no respondió a tiempo. Tu pago fue reembolsado.");
  }
  const cutoffSearch = new Date(Date.now() - SEARCH_TTL_MIN * 60e3).toISOString().replace("T", " ").slice(0, 19);
  const lost = all("SELECT id,student_id FROM bookings WHERE status='buscando' AND created_at < ?", cutoffSearch);
  for (const b of lost) {
    run("UPDATE bookings SET status='sin_tutor', updated_at=datetime('now') WHERE id=?", b.id);
    notify(b.student_id, "Sin tutor disponible", "Ningún tutor aceptó tu solicitud. Puedes reintentar.");
  }
}

function meetingLinkFor(id) {
  const rand = Math.random().toString(36).slice(2, 8);
  return `https://meet.jit.si/TutoresOnLine-${id}-${rand}`;
}

// Franjas horarias libres de un tutor para los próximos N días (hora de Bogotá)
function freeSlots(tutorId, days = 7) {
  const blocks = all("SELECT weekday,start_hour,end_hour FROM availability WHERE tutor_id=?", tutorId);
  const busy = all(
    "SELECT start_at,duration_min FROM bookings WHERE tutor_id=? AND status IN ('pendiente','confirmada','en_curso') AND start_at IS NOT NULL",
    tutorId
  ).map((b) => [Date.parse(b.start_at), Date.parse(b.start_at) + b.duration_min * 60e3]);

  const out = [];
  const nowMs = Date.now();
  const bogotaNow = new Date(nowMs - BOGOTA_OFFSET_H * 3600e3);
  for (let d = 0; d < days; d++) {
    const day = new Date(Date.UTC(bogotaNow.getUTCFullYear(), bogotaNow.getUTCMonth(), bogotaNow.getUTCDate() + d));
    const weekday = day.getUTCDay();
    for (const bl of blocks.filter((x) => x.weekday === weekday)) {
      for (let h = bl.start_hour; h < bl.end_hour; h++) {
        const startMs = Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), h + BOGOTA_OFFSET_H);
        const endMs = startMs + 3600e3;
        if (startMs <= nowMs + 30 * 60e3) continue; // al menos 30 min de anticipación
        if (busy.some(([a, b]) => startMs < b && endMs > a)) continue;
        out.push(new Date(startMs).toISOString());
      }
    }
  }
  return out.sort();
}

function declinedCard(card) {
  // Tarjeta de prueba: termina en 0002 -> rechazada por la pasarela simulada
  return card && String(card).replace(/\s/g, "").endsWith("0002");
}

function refreshRating(tutorId) {
  const r = get("SELECT AVG(score) a, COUNT(*) c FROM ratings WHERE tutor_id=?", tutorId);
  run("UPDATE tutor_profiles SET rating_avg=?, rating_count=? WHERE user_id=?", r.a || 0, r.c || 0, tutorId);
}

// ---------------------------------------------------------------- salud
app.get("/api/health", (_req, res) => res.json({ ok: true, service: "TutoresOn-Line API", time: nowIso() }));

// ---------------------------------------------------------------- auth
app.post("/api/auth/register", wrap(async (req, res) => {
  const { name, email, password, role } = req.body || {};
  if (!name || !email || !password) return bad(res, 422, "Nombre, correo y contraseña son obligatorios");
  if (!/^\S+@\S+\.\S+$/.test(email)) return bad(res, 422, "Correo con formato inválido");
  if (String(password).length < 6) return bad(res, 422, "La contraseña debe tener al menos 6 caracteres");
  if (!["student", "tutor"].includes(role)) return bad(res, 422, "El rol debe ser student o tutor");
  if (get("SELECT 1 FROM users WHERE email=?", norm(email))) return bad(res, 409, "Ese correo ya está registrado");

  const hash = bcrypt.hashSync(password, 10);
  const info = run("INSERT INTO users (name,email,password_hash,role) VALUES (?,?,?,?)", name.trim(), norm(email), hash, role);
  const id = Number(info.lastInsertRowid);

  if (role === "tutor") {
    const t = req.body.tutor || {};
    const subjects = Array.isArray(t.subjects) ? t.subjects.map((s) => String(s).trim()).filter(Boolean) : [];
    if (!subjects.length) {
      run("DELETE FROM users WHERE id=?", id);
      return bad(res, 422, "El tutor debe indicar al menos una materia");
    }
    run(
      `INSERT INTO tutor_profiles (user_id,bio,education,subjects,levels,modality,price_per_hour,city)
       VALUES (?,?,?,?,?,?,?,?)`,
      id, t.bio || "", t.education || "", JSON.stringify(subjects),
      JSON.stringify(Array.isArray(t.levels) ? t.levels : []),
      ["virtual", "presencial", "ambas"].includes(t.modality) ? t.modality : "ambas",
      Math.max(5000, parseInt(t.pricePerHour) || 30000), t.city || "Barranquilla"
    );
    for (const a of all("SELECT id FROM users WHERE role='admin'")) {
      notify(a.id, "Nuevo tutor por verificar", `${name} solicitó verificación de su perfil.`);
    }
  }
  const user = get("SELECT id,name,email,role FROM users WHERE id=?", id);
  notify(id, "¡Bienvenido a TutoresOn-Line!", role === "tutor" ? "Tu perfil está en revisión por el administrador." : "Ya puedes buscar tutores.");
  res.status(201).json({ token: sign(user), user });
}));

app.post("/api/auth/login", wrap(async (req, res) => {
  const { email, password } = req.body || {};
  const u = get("SELECT * FROM users WHERE email=?", norm(email));
  if (!u || !bcrypt.compareSync(String(password || ""), u.password_hash)) return bad(res, 401, "Correo o contraseña incorrectos");
  if (!u.active) return bad(res, 403, "Tu cuenta está suspendida");
  res.json({ token: sign(u), user: { id: u.id, name: u.name, email: u.email, role: u.role } });
}));

app.get("/api/me", auth(), wrap(async (req, res) => {
  const out = { ...req.user };
  if (req.user.role === "tutor") out.profile = tutorRow(get(`${TUTOR_SELECT} WHERE u.id=?`, req.user.id));
  res.json(out);
}));

// ---------------------------------------------------------------- búsqueda de tutores (RF-02, RF-03)
app.get("/api/tutors", wrap(async (req, res) => {
  const { subject, modality, maxPrice, minRating, q, onlineOnly } = req.query;
  let rows = all(`${TUTOR_SELECT} WHERE u.active=1 AND p.verified=1`).map(tutorRow);
  if (subject) rows = rows.filter((t) => t.subjects.some((s) => norm(s).includes(norm(subject))));
  if (q) rows = rows.filter((t) => norm(`${t.name} ${t.bio} ${t.subjects.join(" ")}`).includes(norm(q)));
  if (modality && modality !== "todas") rows = rows.filter((t) => t.modality === "ambas" || t.modality === modality);
  if (maxPrice) rows = rows.filter((t) => t.pricePerHour <= Number(maxPrice));
  if (minRating) rows = rows.filter((t) => t.ratingAvg >= Number(minRating));
  if (onlineOnly === "1" || onlineOnly === "true") rows = rows.filter((t) => t.online);
  rows.sort((a, b) => b.ratingAvg - a.ratingAvg || b.ratingCount - a.ratingCount);
  res.json(rows);
}));

app.get("/api/tutors/:id", wrap(async (req, res) => {
  const row = get(`${TUTOR_SELECT} WHERE u.id=? AND p.verified=1 AND u.active=1`, req.params.id);
  if (!row) return bad(res, 404, "El tutor ya no está disponible");
  const reviews = all(
    `SELECT r.score,r.comment,r.created_at,s.name AS student FROM ratings r JOIN users s ON s.id=r.student_id
     WHERE r.tutor_id=? ORDER BY r.id DESC LIMIT 10`, row.id);
  res.json({ ...tutorRow(row), reviews, slots: freeSlots(row.id, 7) });
}));

// ---------------------------------------------------------------- panel del tutor (RF-11..RF-17)
app.put("/api/tutor/profile", auth("tutor"), wrap(async (req, res) => {
  const t = req.body || {};
  const cur = get("SELECT * FROM tutor_profiles WHERE user_id=?", req.user.id);
  const subjects = Array.isArray(t.subjects) ? t.subjects.map((s) => String(s).trim()).filter(Boolean) : parseJSON(cur.subjects);
  if (!subjects.length) return bad(res, 422, "Debes indicar al menos una materia");
  run(
    `UPDATE tutor_profiles SET bio=?,education=?,subjects=?,levels=?,modality=?,price_per_hour=?,city=? WHERE user_id=?`,
    t.bio ?? cur.bio, t.education ?? cur.education, JSON.stringify(subjects),
    JSON.stringify(Array.isArray(t.levels) ? t.levels : parseJSON(cur.levels)),
    ["virtual", "presencial", "ambas"].includes(t.modality) ? t.modality : cur.modality,
    Math.max(5000, parseInt(t.pricePerHour) || cur.price_per_hour), t.city ?? cur.city, req.user.id
  );
  res.json(tutorRow(get(`${TUTOR_SELECT} WHERE u.id=?`, req.user.id)));
}));

app.get("/api/tutor/availability", auth("tutor"), wrap(async (req, res) => {
  res.json(all("SELECT weekday,start_hour AS startHour,end_hour AS endHour FROM availability WHERE tutor_id=? ORDER BY weekday,start_hour", req.user.id));
}));

app.put("/api/tutor/availability", auth("tutor"), wrap(async (req, res) => {
  const blocks = Array.isArray(req.body) ? req.body : req.body?.blocks;
  if (!Array.isArray(blocks)) return bad(res, 422, "Envía una lista de bloques");
  for (const b of blocks) {
    if (!(b.weekday >= 0 && b.weekday <= 6 && b.startHour >= 0 && b.endHour <= 24 && b.startHour < b.endHour))
      return bad(res, 422, "Bloque horario inválido");
  }
  // Conflicto con reservas ya confirmadas (flujo de excepción del proceso de disponibilidad)
  const booked = all(
    "SELECT start_at FROM bookings WHERE tutor_id=? AND status IN ('pendiente','confirmada') AND start_at > ?", req.user.id, nowIso());
  for (const bk of booked) {
    const local = new Date(Date.parse(bk.start_at) - BOGOTA_OFFSET_H * 3600e3);
    const wd = local.getUTCDay(), h = local.getUTCHours();
    if (!blocks.some((b) => b.weekday === wd && h >= b.startHour && h < b.endHour))
      return bad(res, 409, "El nuevo horario deja por fuera una reserva ya existente", { conflictAt: bk.start_at });
  }
  db.exec("BEGIN");
  try {
    run("DELETE FROM availability WHERE tutor_id=?", req.user.id);
    for (const b of blocks) run("INSERT INTO availability (tutor_id,weekday,start_hour,end_hour) VALUES (?,?,?,?)", req.user.id, b.weekday, b.startHour, b.endHour);
    db.exec("COMMIT");
  } catch (e) { db.exec("ROLLBACK"); throw e; }
  res.json({ ok: true, count: blocks.length });
}));

app.post("/api/tutor/online", auth("tutor"), wrap(async (req, res) => {
  const p = get("SELECT * FROM tutor_profiles WHERE user_id=?", req.user.id);
  const online = !!req.body?.online;
  if (online && p.verified !== 1) return bad(res, 409, "Tu perfil aún no está verificado, no puedes activar el modo en línea");
  if (online && !parseJSON(p.subjects).length) return bad(res, 409, "Configura tus materias antes de activar el modo en línea");
  run("UPDATE tutor_profiles SET online=? WHERE user_id=?", online ? 1 : 0, req.user.id);
  res.json({ online });
}));

app.get("/api/tutor/requests", auth("tutor"), wrap(async (req, res) => {
  expireStale();
  const p = get("SELECT * FROM tutor_profiles WHERE user_id=?", req.user.id);
  const mine = all(`${BOOKING_SELECT} WHERE b.tutor_id=? AND b.status='pendiente' ORDER BY b.start_at`, req.user.id).map(bookingRow);
  let open = [];
  if (p.online && p.verified === 1) {
    const subjects = parseJSON(p.subjects).map(norm);
    open = all(`${BOOKING_SELECT} WHERE b.status='buscando' AND b.type='bajo_demanda' ORDER BY b.id`)
      .filter((b) => subjects.includes(norm(b.subject)) && (b.modality === "virtual" ? p.modality !== "presencial" : p.modality !== "virtual"))
      .map(bookingRow);
  }
  res.json({ pending: mine, onDemand: open });
}));

app.get("/api/tutor/earnings", auth("tutor"), wrap(async (req, res) => {
  const rows = all(
    `SELECT price FROM bookings WHERE tutor_id=? AND status IN ('finalizada','calificada') AND payment_status='aprobado'`, req.user.id);
  const gross = rows.reduce((s, r) => s + r.price, 0);
  res.json({ sessions: rows.length, gross, commission: Math.round(gross * COMMISSION), net: Math.round(gross * (1 - COMMISSION)) });
}));

// ---------------------------------------------------------------- reservas (RF-04, RF-05, RF-09)
app.post("/api/bookings", auth("student"), wrap(async (req, res) => {
  expireStale();
  const { tutorId, subject, topic, startAt, modality, cardNumber } = req.body || {};
  const t = get(`${TUTOR_SELECT} WHERE u.id=? AND p.verified=1 AND u.active=1`, tutorId);
  if (!t) return bad(res, 404, "El tutor ya no está disponible");
  const subjects = parseJSON(t.subjects);
  if (!subjects.map(norm).includes(norm(subject))) return bad(res, 422, "El tutor no dicta esa materia");
  const mod = modality || "virtual";
  if (!["virtual", "presencial"].includes(mod) || (t.modality !== "ambas" && t.modality !== mod))
    return bad(res, 422, `El tutor solo ofrece modalidad ${t.modality}`);
  const slot = new Date(startAt).toISOString();
  if (!freeSlots(t.id, 14).includes(slot))
    return bad(res, 409, "Ese horario ya no está disponible, elige otro");
  if (declinedCard(cardNumber)) return bad(res, 402, "Pago rechazado por la pasarela. Intenta con otro medio de pago.");
  const info = run(
    `INSERT INTO bookings (student_id,tutor_id,type,subject,topic,modality,start_at,duration_min,price,status,payment_status)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    req.user.id, t.id, "programada", subject, topic || "", mod, slot, 60, t.price_per_hour, "pendiente", "aprobado");
  notify(t.id, "Nueva solicitud de reserva", `${req.user.name} solicitó ${subject} para ${slot}.`);
  notify(req.user.id, "Reserva enviada", "Pago aprobado. Esperamos la respuesta del tutor (máx. 24 h).");
  res.status(201).json(getBooking(Number(info.lastInsertRowid)));
}));

app.post("/api/bookings/on-demand", auth("student"), wrap(async (req, res) => {
  expireStale();
  const { subject, topic, modality } = req.body || {};
  if (!subject) return bad(res, 422, "Indica la materia");
  const mod = modality === "presencial" ? "presencial" : "virtual";
  const online = all(`${TUTOR_SELECT} WHERE u.active=1 AND p.verified=1 AND p.online=1`)
    .filter((t) => parseJSON(t.subjects).map(norm).includes(norm(subject)) && (t.modality === "ambas" || t.modality === mod));
  if (!online.length) return bad(res, 409, "No hay tutores en línea para esa materia en este momento. Prueba una reserva programada.", { code: "sin_tutor" });
  const info = run(
    `INSERT INTO bookings (student_id,type,subject,topic,modality,status,payment_status) VALUES (?,?,?,?,?,?,?)`,
    req.user.id, "bajo_demanda", subject, topic || "", mod, "buscando", "pendiente");
  for (const t of online) notify(t.id, "Solicitud inmediata", `${req.user.name} necesita ayuda en ${subject}.`);
  res.status(201).json({ ...getBooking(Number(info.lastInsertRowid)), notifiedTutors: online.length });
}));

app.get("/api/bookings", auth("student", "tutor"), wrap(async (req, res) => {
  expireStale();
  const col = req.user.role === "student" ? "b.student_id" : "b.tutor_id";
  res.json(all(`${BOOKING_SELECT} WHERE ${col}=? ORDER BY b.id DESC`, req.user.id).map(bookingRow));
}));

app.get("/api/bookings/:id", auth(), wrap(async (req, res) => {
  const b = getBooking(req.params.id);
  if (!b) return bad(res, 404, "Reserva no encontrada");
  if (req.user.role !== "admin" && b.student.id !== req.user.id && b.tutor?.id !== req.user.id) return bad(res, 403, "No es tu reserva");
  res.json(b);
}));

function ownBooking(req, res, { asTutor = false, asStudent = false } = {}) {
  const raw = get("SELECT * FROM bookings WHERE id=?", req.params.id);
  if (!raw) { bad(res, 404, "Reserva no encontrada"); return null; }
  const okTutor = asTutor && raw.tutor_id === req.user.id;
  const okStudent = asStudent && raw.student_id === req.user.id;
  if (!okTutor && !okStudent) { bad(res, 403, "No puedes modificar esta reserva"); return null; }
  return raw;
}

app.post("/api/bookings/:id/accept", auth("tutor"), wrap(async (req, res) => {
  expireStale();
  const raw = get("SELECT * FROM bookings WHERE id=?", req.params.id);
  if (!raw) return bad(res, 404, "Reserva no encontrada");
  const p = get("SELECT * FROM tutor_profiles WHERE user_id=?", req.user.id);

  if (raw.type === "bajo_demanda") {
    if (!p.online || p.verified !== 1) return bad(res, 409, "Debes estar en línea y verificado");
    if (!parseJSON(p.subjects).map(norm).includes(norm(raw.subject))) return bad(res, 403, "No dictas esa materia");
    // el primero en aceptar gana (RF-16): UPDATE condicionado al estado
    const info = run(
      `UPDATE bookings SET tutor_id=?, status='confirmada', price=?, payment_status='aprobado',
         start_at=?, meeting_link=?, updated_at=datetime('now') WHERE id=? AND status='buscando'`,
      req.user.id, p.price_per_hour, nowIso(), raw.modality === "virtual" ? meetingLinkFor(raw.id) : null, raw.id);
    if (info.changes !== 1) return bad(res, 409, "Otro tutor ya aceptó esta solicitud");
  } else {
    if (raw.tutor_id !== req.user.id) return bad(res, 403, "No es tu reserva");
    if (raw.status !== "pendiente") return bad(res, 409, `La reserva está en estado ${raw.status}`);
    run(`UPDATE bookings SET status='confirmada', meeting_link=?, updated_at=datetime('now') WHERE id=?`,
      raw.modality === "virtual" ? meetingLinkFor(raw.id) : null, raw.id);
  }
  notify(raw.student_id, "¡Tutoría confirmada!", `${req.user.name} aceptó tu solicitud de ${raw.subject}.`);
  res.json(getBooking(raw.id));
}));

app.post("/api/bookings/:id/reject", auth("tutor"), wrap(async (req, res) => {
  const raw = ownBooking(req, res, { asTutor: true });
  if (!raw) return;
  if (raw.status !== "pendiente") return bad(res, 409, `La reserva está en estado ${raw.status}`);
  run("UPDATE bookings SET status='rechazada', payment_status='reembolsado', updated_at=datetime('now') WHERE id=?", raw.id);
  notify(raw.student_id, "Reserva rechazada", `El tutor no pudo atenderte. Tu pago fue reembolsado${req.body?.reason ? `. Motivo: ${req.body.reason}` : ""}.`);
  res.json(getBooking(raw.id));
}));

app.post("/api/bookings/:id/cancel", auth("student"), wrap(async (req, res) => {
  const raw = ownBooking(req, res, { asStudent: true });
  if (!raw) return;
  if (!["pendiente", "confirmada", "buscando", "sin_tutor"].includes(raw.status)) return bad(res, 409, `No se puede cancelar en estado ${raw.status}`);
  if (raw.status === "confirmada" && raw.type === "programada" && Date.parse(raw.start_at) - Date.now() < 2 * 3600e3)
    return bad(res, 409, "Solo puedes cancelar hasta 2 horas antes de la sesión");
  const refund = raw.payment_status === "aprobado" ? "reembolsado" : raw.payment_status;
  run("UPDATE bookings SET status='cancelada', payment_status=?, updated_at=datetime('now') WHERE id=?", refund, raw.id);
  if (raw.tutor_id) notify(raw.tutor_id, "Reserva cancelada", `${req.user.name} canceló la tutoría de ${raw.subject}.`);
  res.json(getBooking(raw.id));
}));

app.post("/api/bookings/:id/retry", auth("student"), wrap(async (req, res) => {
  const raw = ownBooking(req, res, { asStudent: true });
  if (!raw) return;
  if (raw.status !== "sin_tutor") return bad(res, 409, "Solo puedes reintentar una solicitud sin tutor");
  run("UPDATE bookings SET status='buscando', created_at=datetime('now'), updated_at=datetime('now') WHERE id=?", raw.id);
  res.json(getBooking(raw.id));
}));

app.post("/api/bookings/:id/start", auth("student", "tutor"), wrap(async (req, res) => {
  const raw = get("SELECT * FROM bookings WHERE id=?", req.params.id);
  if (!raw || (raw.student_id !== req.user.id && raw.tutor_id !== req.user.id)) return bad(res, 403, "No es tu reserva");
  if (raw.status !== "confirmada") return bad(res, 409, `La reserva está en estado ${raw.status}`);
  run("UPDATE bookings SET status='en_curso', updated_at=datetime('now') WHERE id=?", raw.id);
  res.json(getBooking(raw.id));
}));

app.post("/api/bookings/:id/finish", auth("tutor"), wrap(async (req, res) => {
  const raw = ownBooking(req, res, { asTutor: true });
  if (!raw) return;
  if (raw.status !== "en_curso") return bad(res, 409, `La reserva está en estado ${raw.status}`);
  run("UPDATE bookings SET status='finalizada', updated_at=datetime('now') WHERE id=?", raw.id);
  notify(raw.student_id, "Tutoría finalizada", "Cuéntanos cómo te fue: califica a tu tutor.");
  res.json(getBooking(raw.id));
}));

app.post("/api/bookings/:id/rate", auth("student"), wrap(async (req, res) => {
  const raw = ownBooking(req, res, { asStudent: true });
  if (!raw) return;
  if (raw.status !== "finalizada") return bad(res, 409, "Solo puedes calificar una tutoría finalizada");
  const score = parseInt(req.body?.score);
  const comment = String(req.body?.comment || "").trim();
  if (!(score >= 1 && score <= 5)) return bad(res, 422, "El puntaje debe estar entre 1 y 5");
  if (BANNED.some((w) => new RegExp(`\\b${w}\\b`, "i").test(comment)))
    return bad(res, 422, "El comentario incumple las políticas de contenido. Modifícalo e intenta de nuevo.");
  run("INSERT INTO ratings (booking_id,student_id,tutor_id,score,comment) VALUES (?,?,?,?,?)", raw.id, raw.student_id, raw.tutor_id, score, comment);
  run("UPDATE bookings SET status='calificada', updated_at=datetime('now') WHERE id=?", raw.id);
  refreshRating(raw.tutor_id);
  notify(raw.tutor_id, "Nueva calificación", `Recibiste ${score}/5 de ${req.user.name}.`);
  res.status(201).json(getBooking(raw.id));
}));

// ---------------------------------------------------------------- notificaciones (RF-24)
app.get("/api/notifications", auth(), wrap(async (req, res) => {
  res.json(all("SELECT id,title,body,read,created_at AS createdAt FROM notifications WHERE user_id=? ORDER BY id DESC LIMIT 50", req.user.id)
    .map((n) => ({ ...n, read: !!n.read })));
}));
app.post("/api/notifications/read", auth(), wrap(async (req, res) => {
  run("UPDATE notifications SET read=1 WHERE user_id=?", req.user.id);
  res.json({ ok: true });
}));

// ---------------------------------------------------------------- administrador (RF-18..RF-23)
app.get("/api/admin/tutors", auth("admin"), wrap(async (req, res) => {
  const status = req.query.status;
  const rows = all(`${TUTOR_SELECT} ORDER BY p.verified, u.id`).map((r) => ({ ...tutorRow(r), email: r.email, rejectReason: r.reject_reason }));
  res.json(status === undefined ? rows : rows.filter((r) => r.verified === Number(status)));
}));

app.post("/api/admin/tutors/:id/verify", auth("admin"), wrap(async (req, res) => {
  const approve = !!req.body?.approve;
  const p = get("SELECT * FROM tutor_profiles WHERE user_id=?", req.params.id);
  if (!p) return bad(res, 404, "Tutor no encontrado");
  if (!approve && !req.body?.reason) return bad(res, 422, "Indica el motivo del rechazo");
  run("UPDATE tutor_profiles SET verified=?, reject_reason=?, online=0 WHERE user_id=?", approve ? 1 : 2, approve ? null : req.body.reason, req.params.id);
  notify(Number(req.params.id), approve ? "Perfil aprobado" : "Perfil rechazado",
    approve ? "Ya apareces en las búsquedas de estudiantes." : `Motivo: ${req.body.reason}. Corrige tu perfil y vuelve a intentarlo.`);
  res.json({ ok: true, verified: approve ? 1 : 2 });
}));

app.get("/api/admin/users", auth("admin"), wrap(async (_req, res) => {
  res.json(all("SELECT id,name,email,role,active,created_at AS createdAt FROM users ORDER BY id DESC").map((u) => ({ ...u, active: !!u.active })));
}));

app.post("/api/admin/users/:id/active", auth("admin"), wrap(async (req, res) => {
  if (Number(req.params.id) === req.user.id) return bad(res, 409, "No puedes suspender tu propia cuenta");
  run("UPDATE users SET active=? WHERE id=?", req.body?.active ? 1 : 0, req.params.id);
  res.json({ ok: true });
}));

app.get("/api/admin/ratings", auth("admin"), wrap(async (_req, res) => {
  res.json(all(`SELECT r.id,r.score,r.comment,r.created_at AS createdAt,s.name AS student,t.name AS tutor
    FROM ratings r JOIN users s ON s.id=r.student_id JOIN users t ON t.id=r.tutor_id ORDER BY r.id DESC LIMIT 100`));
}));

app.delete("/api/admin/ratings/:id", auth("admin"), wrap(async (req, res) => {
  const r = get("SELECT * FROM ratings WHERE id=?", req.params.id);
  if (!r) return bad(res, 404, "Calificación no encontrada");
  run("DELETE FROM ratings WHERE id=?", r.id);
  refreshRating(r.tutor_id);
  res.json({ ok: true });
}));

app.get("/api/admin/stats", auth("admin"), wrap(async (_req, res) => {
  const users = Object.fromEntries(all("SELECT role, COUNT(*) c FROM users GROUP BY role").map((r) => [r.role, r.c]));
  const byStatus = Object.fromEntries(all("SELECT status, COUNT(*) c FROM bookings GROUP BY status").map((r) => [r.status, r.c]));
  const done = get(`SELECT COUNT(*) c, COALESCE(SUM(price),0) s FROM bookings WHERE status IN ('finalizada','calificada') AND payment_status='aprobado'`);
  const subjects = all(`SELECT subject, COUNT(*) c FROM bookings GROUP BY subject ORDER BY c DESC LIMIT 5`);
  const avg = get("SELECT AVG(score) a FROM ratings").a || 0;
  res.json({
    users,
    bookingsByStatus: byStatus,
    sessionsCompleted: done.c,
    grossVolume: done.s,
    platformRevenue: Math.round(done.s * COMMISSION),
    topSubjects: subjects,
    averageRating: Math.round(avg * 10) / 10,
    pendingTutors: get("SELECT COUNT(*) c FROM tutor_profiles WHERE verified=0").c,
  });
}));

// ---------------------------------------------------------------- web estática (si existe el build)
const webDist = process.env.WEB_DIST || path.join(__dirname, "..", "..", "web", "dist");
if (fs.existsSync(path.join(webDist, "index.html"))) {
  app.use(express.static(webDist));
  app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(path.join(webDist, "index.html")));
}

app.use("/api", (_req, res) => bad(res, 404, "Ruta no encontrada"));
app.use((err, _req, res, _next) => {
  console.error(err);
  bad(res, 500, "Error interno del servidor");
});
