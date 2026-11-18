import bcrypt from "bcryptjs";
import { db, get, run, notify } from "./db.js";

const PASS = "demo1234";

function user(name, email, role) {
  const info = run("INSERT INTO users (name,email,password_hash,role) VALUES (?,?,?,?)", name, email, bcrypt.hashSync(PASS, 10), role);
  return Number(info.lastInsertRowid);
}

function tutor(name, email, p, blocks, verified = 1) {
  const id = user(name, email, "tutor");
  run(
    `INSERT INTO tutor_profiles (user_id,bio,education,subjects,levels,modality,price_per_hour,city,verified,online)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    id, p.bio, p.education, JSON.stringify(p.subjects), JSON.stringify(p.levels), p.modality, p.price, p.city, verified, p.online ? 1 : 0);
  for (const [weekday, s, e] of blocks) run("INSERT INTO availability (tutor_id,weekday,start_hour,end_hour) VALUES (?,?,?,?)", id, weekday, s, e);
  return id;
}

export function seedIfEmpty() {
  if (get("SELECT COUNT(*) c FROM users").c > 0) return false;
  db.exec("BEGIN");
  try {
    user("Administrador TutoresOn-Line", "admin@tutoresonline.co", "admin");
    const est = user("Camila Rojas", "estudiante@demo.co", "student");
    user("Andrés Pérez", "estudiante2@demo.co", "student");

    const weekdays = [1, 2, 3, 4, 5];
    const all = (s, e) => [0, 1, 2, 3, 4, 5, 6].map((d) => [d, s, e]);
    const t1 = tutor("Laura Martínez", "laura@demo.co", {
      bio: "Ingeniera de sistemas con 5 años de experiencia dando monitorías de programación y bases de datos.",
      education: "Ingeniería de Sistemas, Universidad del Norte", subjects: ["Programación", "Bases de datos", "Python"],
      levels: ["Universitario", "Bachillerato"], modality: "ambas", price: 35000, city: "Barranquilla", online: true,
    }, [...weekdays.map((d) => [d, 14, 20]), [6, 8, 12]]);
    const t2 = tutor("Carlos Gómez", "carlos@demo.co", {
      bio: "Matemático. Explico cálculo, álgebra lineal y estadística con ejemplos prácticos.",
      education: "Matemáticas, Universidad Nacional", subjects: ["Cálculo", "Álgebra lineal", "Estadística"],
      levels: ["Universitario"], modality: "virtual", price: 30000, city: "Bogotá", online: true,
    }, all(9, 17));
    const t3 = tutor("Mariana Torres", "mariana@demo.co", {
      bio: "Licenciada en idiomas. Preparación para exámenes de inglés y conversación.",
      education: "Licenciatura en Lenguas Modernas, Universidad del Atlántico", subjects: ["Inglés", "Redacción"],
      levels: ["Bachillerato", "Universitario", "Adultos"], modality: "ambas", price: 28000, city: "Barranquilla", online: false,
    }, [...weekdays.map((d) => [d, 16, 21])]);
    const t4 = tutor("Julián Herrera", "julian@demo.co", {
      bio: "Físico y químico, apoyo en ciencias para bachillerato y primeros semestres.",
      education: "Física, Universidad de Antioquia", subjects: ["Física", "Química"],
      levels: ["Bachillerato", "Universitario"], modality: "ambas", price: 32000, city: "Medellín", online: false,
    }, weekdays.map((d) => [d, 18, 22]));
    tutor("Sofía Ramírez", "sofia@demo.co", {
      bio: "Contadora pública, tutorías de contabilidad y finanzas.",
      education: "Contaduría Pública, Universidad de Cartagena", subjects: ["Contabilidad", "Finanzas"],
      levels: ["Universitario"], modality: "virtual", price: 30000, city: "Cartagena", online: false,
    }, [[6, 8, 14]], 0); // pendiente de verificación para la demo del administrador

    // Historial para que los perfiles muestren reseñas
    const past = (stu, tid, subject, score, comment, price) => {
      const b = run(
        `INSERT INTO bookings (student_id,tutor_id,type,subject,modality,start_at,price,status,payment_status)
         VALUES (?,?,?,?,?,?,?,?,?)`, stu, tid, "programada", subject, "virtual", new Date(Date.now() - 5 * 864e5).toISOString(), price, "calificada", "aprobado");
      run("INSERT INTO ratings (booking_id,student_id,tutor_id,score,comment) VALUES (?,?,?,?,?)", Number(b.lastInsertRowid), stu, tid, score, comment);
    };
    const est2 = get("SELECT id FROM users WHERE email='estudiante2@demo.co'").id;
    past(est2, t1, "Python", 5, "Muy clara explicando funciones y listas. Totalmente recomendada.", 35000);
    past(est2, t1, "Bases de datos", 5, "Me ayudó a entender las consultas JOIN.", 35000);
    past(est2, t2, "Cálculo", 4, "Buenas explicaciones, algo rápido con los límites.", 30000);
    past(est2, t3, "Inglés", 5, "Excelente para practicar conversación.", 28000);
    past(est2, t4, "Física", 4, "Resolvió todas mis dudas de cinemática.", 32000);
    for (const id of [t1, t2, t3, t4]) {
      const r = get("SELECT AVG(score) a, COUNT(*) c FROM ratings WHERE tutor_id=?", id);
      run("UPDATE tutor_profiles SET rating_avg=?, rating_count=? WHERE user_id=?", r.a, r.c, id);
    }
    notify(est, "¡Bienvenida!", "Explora tutores y reserva tu primera tutoría.");
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
  console.log("Base de datos inicializada con datos de demostración (contraseña: " + PASS + ")");
  return true;
}

if (process.argv[1] && process.argv[1].endsWith("seed.js")) seedIfEmpty();
