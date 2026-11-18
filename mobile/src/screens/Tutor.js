import { useCallback, useEffect, useState } from "react";
import { ScrollView, Text, View, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { get, post, put, cop, fmtDateTime, MODALITY, WEEKDAYS } from "../api";
import { useAuth } from "../auth";
import { Btn, C, Empty, ErrorText, Field, Info, Loading, OkText, Sheet, s, useAction, useLoad } from "../ui";

export function Requests() {
  const { user, refreshMe } = useAuth();
  const p = user.profile;
  const { data, error, loading, reload } = useLoad(() => get("/tutor/requests"), [p?.online], 5000);
  useFocusEffect(useCallback(() => { reload(true); }, [reload]));
  const { busy, error: actErr, run, setError } = useAction();
  const [rej, setRej] = useState(null);
  const [reason, setReason] = useState("");

  const toggle = () => run(async () => { await post("/tutor/online", { online: !p.online }); await refreshMe(); });
  const accept = (b) => run(async () => { try { await post(`/bookings/${b.id}/accept`); } finally { reload(true); } });
  const reject = () => run(async () => { await post(`/bookings/${rej.id}/reject`, { reason }); setRej(null); setReason(""); reload(true); });

  return (
    <SafeAreaView style={s.screen} edges={["top"]}>
      <ScrollView contentContainerStyle={s.pad} refreshControl={<RefreshControl refreshing={false} onRefresh={() => reload(true)} />}>
        <Text style={s.h1}>Solicitudes</Text>
        {p.verified === 0 && <Info>Tu perfil está en revisión. Aparecerás en las búsquedas cuando el administrador lo apruebe.</Info>}
        {p.verified === 2 && <ErrorText error={{ message: "Tu perfil fue rechazado. Corrígelo en la pestaña Perfil." }} />}
        <View style={s.card}>
          <Text style={s.h2}>Modo "disponible ahora"</Text>
          <Text style={s.muted}>Recibe solicitudes inmediatas de estudiantes para tus materias.</Text>
          <View style={{ height: 10 }} />
          <Btn color={p.online ? C.red : C.green} title={p.online ? "Desactivar (estás en línea)" : "Activar modo en línea"} onPress={toggle} disabled={busy} />
        </View>
        <ErrorText error={actErr || error} />
        {loading && !data ? <Loading /> : (<>
          <Text style={s.h2}>Tutorías inmediatas</Text>
          {!p.online && <Text style={s.muted}>Activa el modo en línea para ver solicitudes inmediatas.</Text>}
          {p.online && data?.onDemand.length === 0 && <Empty text="Esperando solicitudes…" />}
          {data?.onDemand.map((b) => (
            <View key={b.id} style={[s.card, { borderLeftWidth: 4, borderLeftColor: C.orange }]}>
              <Text style={{ fontWeight: "700" }}>{b.subject} — {b.topic || "sin descripción"}</Text>
              <Text style={s.muted}>{b.student.name} · {MODALITY[b.modality]}</Text>
              <View style={{ height: 8 }} /><Btn color={C.orange} title="Aceptar ahora" onPress={() => accept(b)} disabled={busy} />
            </View>
          ))}
          <Text style={[s.h2, { marginTop: 8 }]}>Reservas por responder</Text>
          {data?.pending.length === 0 && <Empty text="No tienes reservas pendientes." />}
          {data?.pending.map((b) => (
            <View key={b.id} style={s.card}>
              <Text style={{ fontWeight: "700" }}>{b.subject} — {b.topic || "sin tema"}</Text>
              <Text style={s.muted}>{b.student.name} · {fmtDateTime(b.startAt)} · {MODALITY[b.modality]} · {cop(b.price)}</Text>
              <View style={[s.row, { marginTop: 8 }]}>
                <Btn small color={C.green} title="Aceptar" onPress={() => accept(b)} disabled={busy} />
                <Btn small ghost title="Rechazar" onPress={() => { setRej(b); setError(null); }} disabled={busy} />
              </View>
            </View>
          ))}
        </>)}
      </ScrollView>
      <Sheet visible={!!rej} title="Rechazar reserva" onClose={() => setRej(null)}>
        <Text style={s.muted}>El estudiante será notificado y su pago reembolsado.</Text>
        <Field label="Motivo (opcional)" value={reason} onChangeText={setReason} />
        <View style={{ height: 10 }} /><Btn color={C.red} title="Confirmar rechazo" onPress={reject} disabled={busy} />
      </Sheet>
    </SafeAreaView>
  );
}

export function Availability() {
  const { data, loading } = useLoad(() => get("/tutor/availability"), []);
  const [blocks, setBlocks] = useState([]);
  const [saved, setSaved] = useState("");
  const { busy, error, run } = useAction();
  useEffect(() => { if (data) setBlocks(data); }, [data]);
  const upd = (i, k, v) => setBlocks((bs) => bs.map((b, j) => (j === i ? { ...b, [k]: Math.max(0, Math.min(24, Number(v) || 0)) } : b)));
  const day = (i, d) => setBlocks((bs) => bs.map((b, j) => (j === i ? { ...b, weekday: (b.weekday + d + 7) % 7 } : b)));
  const save = () => run(async () => { setSaved(""); await put("/tutor/availability", blocks); setSaved("Disponibilidad guardada."); });
  const Num = ({ v, onChange }) => <View style={{ width: 54 }}><Field label="" value={String(v)} onChangeText={onChange} keyboardType="numeric" /></View>;

  return (
    <SafeAreaView style={s.screen} edges={["top"]}>
      <ScrollView contentContainerStyle={s.pad} keyboardShouldPersistTaps="handled">
        <Text style={s.h1}>Disponibilidad semanal</Text>
        <Text style={s.muted}>Bloques en los que das tutorías programadas (hora de Colombia, 0-24 h). Cada hora es una franja reservable.</Text>
        {loading && !data ? <Loading /> : (
          <View style={[s.card, { marginTop: 10 }]}>
            {blocks.length === 0 && <Text style={s.muted}>Aún no tienes bloques.</Text>}
            {blocks.map((b, i) => (
              <View key={i} style={[s.row, { marginBottom: 6 }]}>
                <Btn small ghost title="◀" onPress={() => day(i, -1)} />
                <Text style={{ width: 84, textAlign: "center", fontWeight: "700" }}>{WEEKDAYS[b.weekday]}</Text>
                <Btn small ghost title="▶" onPress={() => day(i, 1)} />
                <Num v={b.startHour} onChange={(v) => upd(i, "startHour", v)} /><Text>a</Text><Num v={b.endHour} onChange={(v) => upd(i, "endHour", v)} />
                <Btn small ghost title="✕" onPress={() => setBlocks(blocks.filter((_, j) => j !== i))} />
              </View>
            ))}
            <View style={[s.row, { marginTop: 8 }]}>
              <Btn small ghost title="+ Bloque" onPress={() => setBlocks([...blocks, { weekday: 1, startHour: 14, endHour: 18 }])} />
              <Btn small color={C.green} title={busy ? "Guardando…" : "Guardar"} onPress={save} disabled={busy} />
            </View>
            <ErrorText error={error} /><OkText text={saved} />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

export function Profile() {
  const { user, refreshMe, logout } = useAuth();
  const p = user.profile;
  const [f, setF] = useState({ subjects: p.subjects.join(", "), levels: p.levels.join(", "), modality: p.modality, price: String(p.pricePerHour), city: p.city, education: p.education, bio: p.bio });
  const [ok, setOk] = useState("");
  const { busy, error, run } = useAction();
  const { data: earn } = useLoad(() => get("/tutor/earnings"), []);
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));
  const list = (t) => t.split(",").map((x) => x.trim()).filter(Boolean);
  const save = () => run(async () => { setOk(""); await put("/tutor/profile", { subjects: list(f.subjects), levels: list(f.levels), modality: f.modality, pricePerHour: Number(f.price), city: f.city, education: f.education, bio: f.bio }); await refreshMe(); setOk("Perfil actualizado."); });

  return (
    <SafeAreaView style={s.screen} edges={["top"]}>
      <ScrollView contentContainerStyle={s.pad} keyboardShouldPersistTaps="handled">
        <Text style={s.h1}>Perfil e ingresos</Text>
        {earn && (
          <View style={s.card}>
            <Text style={s.muted}>Tutorías completadas: <Text style={{ fontWeight: "700", color: C.text }}>{earn.sessions}</Text></Text>
            <Text style={s.muted}>Ingresos brutos: <Text style={{ fontWeight: "700", color: C.text }}>{cop(earn.gross)}</Text></Text>
            <Text style={s.muted}>Comisión plataforma (15%): <Text style={{ fontWeight: "700", color: C.text }}>{cop(earn.commission)}</Text></Text>
            <Text style={{ color: C.green, fontWeight: "800", fontSize: 18, marginTop: 4 }}>Neto para ti: {cop(earn.net)}</Text>
          </View>
        )}
        <View style={s.card}>
          <Field label="Materias (separadas por coma)" value={f.subjects} onChangeText={set("subjects")} />
          <Field label="Niveles" value={f.levels} onChangeText={set("levels")} />
          <Text style={s.label}>Modalidad</Text>
          <View style={s.row}>{["ambas", "virtual", "presencial"].map((m) => <Btn key={m} small ghost={f.modality !== m} title={MODALITY[m]} onPress={() => set("modality")(m)} />)}</View>
          <Field label="Precio por hora (COP)" value={f.price} onChangeText={set("price")} keyboardType="numeric" />
          <Field label="Ciudad" value={f.city} onChangeText={set("city")} />
          <Field label="Formación académica" value={f.education} onChangeText={set("education")} />
          <Field label="Presentación" value={f.bio} onChangeText={set("bio")} multiline />
          <ErrorText error={error} /><OkText text={ok} />
          <View style={{ height: 10 }} /><Btn title="Guardar cambios" onPress={save} disabled={busy} />
        </View>
        <Btn ghost title="Cerrar sesión" onPress={logout} />
      </ScrollView>
    </SafeAreaView>
  );
}
