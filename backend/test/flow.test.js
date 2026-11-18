import test from "node:test";
import assert from "node:assert/strict";

process.env.DB_FILE = ":memory:";
const { app } = await import("../src/app.js");
const { seedIfEmpty } = await import("../src/seed.js");
seedIfEmpty();

const server = app.listen(0);
const base = `http://127.0.0.1:${server.address().port}/api`;
test.after(() => server.close());

async function call(method, path, body, token) {
  const r = await fetch(base + path, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, data: await r.json() };
}
const login = async (email) => (await call("POST", "/auth/login", { email, password: "demo1234" })).data.token;

test("flujo completo de reserva programada", async () => {
  const est = await login("estudiante@demo.co");
  const laura = await login("laura@demo.co");

  const search = await call("GET", "/tutors?subject=python&maxPrice=40000");
  assert.equal(search.status, 200);
  const tutor = search.data.find((t) => t.name === "Laura Martínez");
  assert.ok(tutor, "Laura aparece en la búsqueda");

  const detail = await call("GET", `/tutors/${tutor.id}`);
  assert.ok(detail.data.slots.length > 3, "hay franjas libres");
  assert.ok(detail.data.reviews.length >= 2, "hay reseñas");
  const slot = detail.data.slots[0];

  const declined = await call("POST", "/bookings", { tutorId: tutor.id, subject: "Python", startAt: slot, cardNumber: "4000 0000 0000 0002" }, est);
  assert.equal(declined.status, 402);

  const book = await call("POST", "/bookings", { tutorId: tutor.id, subject: "Python", topic: "Listas", startAt: slot, modality: "virtual", cardNumber: "4242424242424242" }, est);
  assert.equal(book.status, 201);
  assert.equal(book.data.status, "pendiente");

  const dup = await call("POST", "/bookings", { tutorId: tutor.id, subject: "Python", startAt: slot, modality: "virtual" }, est);
  assert.equal(dup.status, 409, "no permite doble reserva del mismo horario");

  const reqs = await call("GET", "/tutor/requests", null, laura);
  assert.ok(reqs.data.pending.some((b) => b.id === book.data.id));

  const acc = await call("POST", `/bookings/${book.data.id}/accept`, null, laura);
  assert.equal(acc.data.status, "confirmada");
  assert.match(acc.data.meetingLink, /^https:\/\/meet\.jit\.si\//);

  // conflicto de disponibilidad con reserva existente
  const conflict = await call("PUT", "/tutor/availability", [], laura);
  assert.equal(conflict.status, 409);

  assert.equal((await call("POST", `/bookings/${book.data.id}/start`, null, est)).data.status, "en_curso");
  assert.equal((await call("POST", `/bookings/${book.data.id}/finish`, null, laura)).data.status, "finalizada");

  const rude = await call("POST", `/bookings/${book.data.id}/rate`, { score: 1, comment: "eres un idiota" }, est);
  assert.equal(rude.status, 422);
  const rated = await call("POST", `/bookings/${book.data.id}/rate`, { score: 5, comment: "Excelente" }, est);
  assert.equal(rated.data.status, "calificada");
  const again = await call("POST", `/bookings/${book.data.id}/rate`, { score: 5 }, est);
  assert.equal(again.status, 409);

  const after = await call("GET", `/tutors/${tutor.id}`);
  assert.equal(after.data.ratingCount, 3);

  const earn = await call("GET", "/tutor/earnings", null, laura);
  assert.equal(earn.data.net, Math.round(earn.data.gross * 0.85));
});

test("rechazo y cancelación reembolsan", async () => {
  const est = await login("estudiante@demo.co");
  const carlos = await login("carlos@demo.co");
  const id = (await call("GET", "/tutors?subject=cálculo")).data[0].id;
  const slot = (await call("GET", `/tutors/${id}`)).data.slots[2];
  const b = await call("POST", "/bookings", { tutorId: id, subject: "Cálculo", startAt: slot }, est);
  assert.equal(b.status, 201);
  const rej = await call("POST", `/bookings/${b.data.id}/reject`, { reason: "Conflicto" }, carlos);
  assert.equal(rej.data.paymentStatus, "reembolsado");
  const notifs = await call("GET", "/notifications", null, est);
  assert.ok(notifs.data.some((n) => n.title === "Reserva rechazada"));

  const slot2 = (await call("GET", `/tutors/${id}`)).data.slots[3];
  const b2 = await call("POST", "/bookings", { tutorId: id, subject: "Cálculo", startAt: slot2 }, est);
  const can = await call("POST", `/bookings/${b2.data.id}/cancel`, null, est);
  assert.equal(can.data.status, "cancelada");
  assert.equal(can.data.paymentStatus, "reembolsado");
});

test("tutoría bajo demanda: primero en aceptar gana", async () => {
  const est = await login("estudiante@demo.co");
  const laura = await login("laura@demo.co");
  const mariana = await login("mariana@demo.co");

  const none = await call("POST", "/bookings/on-demand", { subject: "Inglés" }, est);
  assert.equal(none.status, 409);
  assert.equal(none.data.code, "sin_tutor");

  assert.equal((await call("POST", "/tutor/online", { online: true }, mariana)).status, 200);
  const od = await call("POST", "/bookings/on-demand", { subject: "Python", topic: "Ayuda con bucles" }, est);
  assert.equal(od.status, 201);
  assert.equal(od.data.status, "buscando");

  const reqs = await call("GET", "/tutor/requests", null, laura);
  assert.ok(reqs.data.onDemand.some((b) => b.id === od.data.id));
  const wrong = await call("POST", `/bookings/${od.data.id}/accept`, null, mariana);
  assert.equal(wrong.status, 403, "tutor que no dicta la materia no puede aceptar");

  const acc = await call("POST", `/bookings/${od.data.id}/accept`, null, laura);
  assert.equal(acc.data.status, "confirmada");
  assert.equal(acc.data.paymentStatus, "aprobado");
  const second = await call("POST", `/bookings/${od.data.id}/accept`, null, laura);
  assert.equal(second.status, 409);
});

test("registro de tutor y verificación por el administrador", async () => {
  const dup = await call("POST", "/auth/register", { name: "X", email: "estudiante@demo.co", password: "abcdef", role: "student" });
  assert.equal(dup.status, 409);
  const weak = await call("POST", "/auth/register", { name: "X", email: "x@x.co", password: "123", role: "student" });
  assert.equal(weak.status, 422);

  const reg = await call("POST", "/auth/register", {
    name: "Nuevo Tutor", email: "nuevo@demo.co", password: "secreto1", role: "tutor",
    tutor: { subjects: ["Química"], pricePerHour: 25000, modality: "virtual" },
  });
  assert.equal(reg.status, 201);
  const tk = reg.data.token;
  const early = await call("POST", "/tutor/online", { online: true }, tk);
  assert.equal(early.status, 409, "no puede activar modo en línea sin verificación");

  const admin = await login("admin@tutoresonline.co");
  const pending = await call("GET", "/admin/tutors?status=0", null, admin);
  assert.ok(pending.data.some((t) => t.name === "Nuevo Tutor"));
  const id = pending.data.find((t) => t.name === "Nuevo Tutor").id;
  assert.equal((await call("POST", `/admin/tutors/${id}/verify`, { approve: false }, admin)).status, 422);
  assert.equal((await call("POST", `/admin/tutors/${id}/verify`, { approve: true }, admin)).status, 200);
  assert.equal((await call("POST", "/tutor/online", { online: true }, tk)).status, 200);

  const stats = await call("GET", "/admin/stats", null, admin);
  assert.ok(stats.data.sessionsCompleted >= 5);
  const forbidden = await call("GET", "/admin/stats", null, await login("estudiante@demo.co"));
  assert.equal(forbidden.status, 403);
  assert.equal((await call("GET", "/me")).status, 401);
});
