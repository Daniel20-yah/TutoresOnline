import { useEffect, useState } from "react";
import { FlatList, Linking, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback } from "react";
import { useAuth } from "../auth";
import { get, post, cop, dayKey, fmtDay, fmtTime, fmtDb, fmtDateTime, MODALITY } from "../api";
import { Btn, C, Chip, Empty, ErrorText, Field, Info, Loading, Sheet, Stars, Tag, s, useAction, useLoad } from "../ui";

export function Search({ navigation }) {
  const [q, setQ] = useState("");
  const [modality, setModality] = useState("todas");
  const [maxPrice, setMaxPrice] = useState("");
  const [onlineOnly, setOnlineOnly] = useState(false);
  const [applied, setApplied] = useState({ q, modality, maxPrice, onlineOnly });
  useEffect(() => { const t = setTimeout(() => setApplied({ q, modality, maxPrice, onlineOnly }), 350); return () => clearTimeout(t); }, [q, modality, maxPrice, onlineOnly]);
  const qs = new URLSearchParams();
  if (applied.q) qs.set("q", applied.q);
  if (applied.modality !== "todas") qs.set("modality", applied.modality);
  if (applied.maxPrice) qs.set("maxPrice", applied.maxPrice);
  if (applied.onlineOnly) qs.set("onlineOnly", "1");
  const { data, error, loading, reload } = useLoad(() => get("/tutors?" + qs.toString()), [JSON.stringify(applied)]);

  return (
    <SafeAreaView style={s.screen} edges={["top"]}>
      <FlatList
        data={data || []} keyExtractor={(t) => String(t.id)} contentContainerStyle={s.pad}
        refreshControl={<RefreshControl refreshing={false} onRefresh={() => reload(true)} />}
        ListHeaderComponent={<View>
          <Text style={s.h1}>Encuentra tu tutor</Text>
          <View style={s.card}>
            <Field label="Materia o nombre" value={q} onChangeText={setQ} placeholder="Ej: Python, cálculo…" />
            <Text style={s.label}>Modalidad</Text>
            <View style={s.row}>{[["todas", "Todas"], ["virtual", "Virtual"], ["presencial", "Presencial"]].map(([v, l]) => <Btn key={v} small ghost={modality !== v} title={l} onPress={() => setModality(v)} />)}</View>
            <Field label="Precio máx. por hora" value={maxPrice} onChangeText={setMaxPrice} keyboardType="numeric" placeholder="Sin límite" />
            <View style={{ height: 8 }} />
            <Btn small ghost={!onlineOnly} title={onlineOnly ? "● Solo en línea ahora" : "Solo en línea ahora"} onPress={() => setOnlineOnly(!onlineOnly)} />
          </View>
          <ErrorText error={error} />
          {loading && !data && <Loading />}
        </View>}
        ListEmptyComponent={!loading ? <Empty text="No encontramos tutores con esos filtros." /> : null}
        renderItem={({ item: t }) => (
          <Pressable style={s.card} onPress={() => navigation.navigate("TutorDetail", { id: t.id, name: t.name })}>
            <View style={s.between}><Text style={[s.h2, { marginBottom: 0 }]}>{t.name}</Text>{t.online && <Text style={{ color: C.green, fontWeight: "700", fontSize: 12 }}>● En línea</Text>}</View>
            <Stars value={t.ratingAvg} count={t.ratingCount} />
            <View style={[s.row, { marginVertical: 6 }]}>{t.subjects.map((x) => <Tag key={x} t={x} />)}</View>
            <Text style={s.muted} numberOfLines={2}>{t.bio}</Text>
            <View style={[s.between, { marginTop: 6 }]}><Text style={{ color: C.blue, fontWeight: "700" }}>{cop(t.pricePerHour)}/h</Text><Text style={s.muted}>{MODALITY[t.modality]} · {t.city}</Text></View>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

export function TutorDetail({ route, navigation }) {
  const { id } = route.params;
  const { data: t, error, loading, reload } = useLoad(() => get(`/tutors/${id}`), [id]);
  const [slot, setSlot] = useState(null);
  const [f, setF] = useState({ subject: "", topic: "", modality: "virtual", card: "4242 4242 4242 4242" });
  const { busy, error: bookErr, run, setError } = useAction();

  if (loading && !t) return <Loading />;
  if (error) return <View style={s.pad}><ErrorText error={error} /></View>;
  const byDay = {};
  t.slots.forEach((x) => { (byDay[dayKey(x)] ||= []).push(x); });
  const open = (x) => { setSlot(x); setError(null); setF((v) => ({ ...v, subject: t.subjects[0], modality: t.modality === "presencial" ? "presencial" : "virtual" })); };
  const pay = () => run(async () => {
    try {
      await post("/bookings", { tutorId: t.id, subject: f.subject, topic: f.topic, startAt: slot, modality: f.modality, cardNumber: f.card });
      setSlot(null);
      navigation.navigate("Tabs", { screen: "MisTutorias" });
    } catch (e) { if (e.status === 409) reload(true); throw e; }
  });

  return (
    <View style={s.screen}>
      <ScrollView contentContainerStyle={s.pad}>
        <View style={s.card}>
          <View style={s.between}><Text style={s.h1}>{t.name}</Text>{t.online && <Text style={{ color: C.green, fontWeight: "700" }}>● En línea</Text>}</View>
          <Stars value={t.ratingAvg} count={t.ratingCount} />
          <View style={[s.row, { marginVertical: 8 }]}>{t.subjects.map((x) => <Tag key={x} t={x} />)}</View>
          <Text style={s.text}>{t.bio}</Text>
          <Text style={[s.muted, { marginTop: 8 }]}>🎓 {t.education || "—"}{"\n"}📍 {t.city} · {MODALITY[t.modality]}{"\n"}Niveles: {t.levels.join(", ") || "—"}</Text>
          <Text style={{ color: C.blue, fontWeight: "700", marginTop: 8, fontSize: 17 }}>{cop(t.pricePerHour)} por hora</Text>
        </View>
        <View style={s.card}>
          <Text style={s.h2}>Horarios disponibles</Text>
          {Object.keys(byDay).length === 0 && <Text style={s.muted}>Sin horarios libres próximamente.</Text>}
          {Object.entries(byDay).map(([d, list]) => (
            <View key={d} style={{ marginTop: 8 }}>
              <Text style={{ fontWeight: "700", color: C.text }}>{fmtDay(list[0])}</Text>
              <View style={[s.row, { marginTop: 6 }]}>{list.map((x) => <Btn key={x} small ghost title={fmtTime(x)} onPress={() => open(x)} />)}</View>
            </View>
          ))}
        </View>
        <View style={s.card}>
          <Text style={s.h2}>Reseñas</Text>
          {t.reviews.length === 0 && <Text style={s.muted}>Aún no tiene reseñas.</Text>}
          {t.reviews.map((r, i) => (
            <View key={i} style={{ borderTopWidth: i ? 1 : 0, borderColor: C.line, paddingVertical: 8 }}>
              <View style={s.row}><Stars value={r.score} /><Text style={{ fontWeight: "700" }}>{r.student}</Text></View>
              <Text style={s.text}>{r.comment}</Text><Text style={s.muted}>{fmtDb(r.created_at)}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
      <Sheet visible={!!slot} title="Confirmar reserva" onClose={() => setSlot(null)}>
        {slot && (<>
          <Info>{fmtDay(slot)}, {fmtTime(slot)} · 1 hora · {cop(t.pricePerHour)}</Info>
          <Text style={s.label}>Materia</Text>
          <View style={s.row}>{t.subjects.map((x) => <Btn key={x} small ghost={f.subject !== x} title={x} onPress={() => setF({ ...f, subject: x })} />)}</View>
          <Field label="Tema a trabajar" value={f.topic} onChangeText={(v) => setF({ ...f, topic: v })} placeholder="Ej: Listas y diccionarios" />
          {t.modality === "ambas" && (<><Text style={s.label}>Modalidad</Text><View style={s.row}>{["virtual", "presencial"].map((m) => <Btn key={m} small ghost={f.modality !== m} title={MODALITY[m]} onPress={() => setF({ ...f, modality: m })} />)}</View></>)}
          <Field label="Tarjeta (simulada)" value={f.card} onChangeText={(v) => setF({ ...f, card: v })} keyboardType="numeric" hint="4242… aprueba el pago · terminada en 0002 lo rechaza" />
          <ErrorText error={bookErr} />
          <View style={{ height: 10 }} />
          <Btn color={C.green} title={busy ? "Procesando pago…" : `Pagar ${cop(t.pricePerHour)} y reservar`} onPress={pay} disabled={busy} />
        </>)}
      </Sheet>
    </View>
  );
}

export function OnDemand() {
  const [f, setF] = useState({ subject: "", topic: "", modality: "virtual" });
  const [booking, setBooking] = useState(null);
  const [notified, setNotified] = useState(0);
  const { busy, error, run } = useAction();

  useEffect(() => {
    if (!booking || booking.status !== "buscando") return undefined;
    const t = setInterval(async () => { try { setBooking(await get(`/bookings/${booking.id}`)); } catch { /* reintenta */ } }, 3000);
    return () => clearInterval(t);
  }, [booking?.id, booking?.status]);

  const send = () => run(async () => { const b = await post("/bookings/on-demand", f); setNotified(b.notifiedTutors); setBooking(b); });
  const act = (p) => run(async () => setBooking(await post(`/bookings/${booking.id}/${p}`)));

  return (
    <SafeAreaView style={s.screen} edges={["top"]}>
      <ScrollView contentContainerStyle={s.pad} keyboardShouldPersistTaps="handled">
        <Text style={s.h1}>Tutoría inmediata</Text>
        {!booking ? (
          <View style={s.card}>
            <Text style={s.muted}>Describe lo que necesitas y te conectamos con el primer tutor en línea que pueda ayudarte.</Text>
            <Field label="Materia" value={f.subject} onChangeText={(v) => setF({ ...f, subject: v })} placeholder="Ej: Python" />
            <Field label="¿En qué necesitas ayuda?" value={f.topic} onChangeText={(v) => setF({ ...f, topic: v })} multiline />
            <Text style={s.label}>Modalidad</Text>
            <View style={s.row}>{["virtual", "presencial"].map((m) => <Btn key={m} small ghost={f.modality !== m} title={MODALITY[m]} onPress={() => setF({ ...f, modality: m })} />)}</View>
            <ErrorText error={error} />
            <View style={{ height: 10 }} />
            <Btn color={C.orange} title={busy ? "Enviando…" : "Buscar tutor ahora"} onPress={send} disabled={busy || !f.subject.trim()} />
          </View>
        ) : (
          <View style={s.card}>
            <View style={s.between}><Text style={s.h2}>{booking.subject}</Text><Chip status={booking.status} /></View>
            {booking.topic ? <Text style={s.text}>{booking.topic}</Text> : null}
            {booking.status === "buscando" && <Info>Buscando tutor… avisamos a {notified || "varios"} tutor(es) en línea. El primero que acepte te atenderá.</Info>}
            {booking.status === "confirmada" && (<>
              <Info color={C.green}>¡{booking.tutor?.name} aceptó tu solicitud! Valor: {cop(booking.price)} (pago aprobado).</Info>
              {booking.meetingLink ? <Btn color={C.green} title="Entrar a la videollamada" onPress={() => { post(`/bookings/${booking.id}/start`).catch(() => {}); Linking.openURL(booking.meetingLink); }} /> : <Info>Coordina el punto de encuentro con tu tutor.</Info>}
            </>)}
            {booking.status === "sin_tutor" && <ErrorText error={{ message: "Ningún tutor aceptó a tiempo. Puedes reintentar o reservar una tutoría programada." }} />}
            <ErrorText error={error} />
            <View style={[s.row, { marginTop: 10 }]}>
              {booking.status === "sin_tutor" && <Btn small title="Reintentar" onPress={() => act("retry")} disabled={busy} />}
              {["buscando", "sin_tutor", "confirmada"].includes(booking.status) && <Btn small ghost title="Cancelar" onPress={() => act("cancel")} disabled={busy} />}
              <Btn small ghost title="Nueva solicitud" onPress={() => setBooking(null)} />
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

export function MyBookings({ role }) {
  const isTutor = role === "tutor";
  const { data, error, loading, reload } = useLoad(() => get("/bookings"), [], 6000);
  useFocusEffect(useCallback(() => { reload(true); }, [reload]));
  const { busy, error: actErr, run } = useAction();
  const [rating, setRating] = useState(null);
  const [score, setScore] = useState(5);
  const [comment, setComment] = useState("");
  const rate = useAction();

  const act = (b, p) => run(async () => { await post(`/bookings/${b.id}/${p}`); await reload(true); });
  const open = (b) => { if (b.meetingLink) Linking.openURL(b.meetingLink); };
  const submit = () => rate.run(async () => { await post(`/bookings/${rating.id}/rate`, { score, comment }); setRating(null); setComment(""); setScore(5); reload(true); });

  return (
    <SafeAreaView style={s.screen} edges={["top"]}>
      <FlatList
        data={data || []} keyExtractor={(b) => String(b.id)} contentContainerStyle={s.pad}
        refreshControl={<RefreshControl refreshing={false} onRefresh={() => reload(true)} />}
        ListHeaderComponent={<View><Text style={s.h1}>Mis tutorías</Text><ErrorText error={error || actErr} />{loading && !data && <Loading />}</View>}
        ListEmptyComponent={!loading ? <Empty text="Todavía no tienes tutorías." /> : null}
        renderItem={({ item: b }) => (
          <View style={s.card}>
            <View style={s.between}><Text style={[s.h2, { marginBottom: 0, flex: 1 }]}>{b.subject} <Text style={s.muted}>#{b.id}</Text></Text><Chip status={b.status} /></View>
            <Text style={[s.muted, { marginTop: 4 }]}>
              {isTutor ? `Estudiante: ${b.student.name}` : `Tutor: ${b.tutor?.name || "Buscando…"}`} · {b.type === "bajo_demanda" ? "Inmediata" : "Programada"} · {MODALITY[b.modality]}
              {b.startAt ? `\n${fmtDateTime(b.startAt)}` : ""}{"\n"}{cop(b.price)} · Pago: {b.paymentStatus}
            </Text>
            {b.topic ? <Text style={[s.text, { marginTop: 4 }]}>📝 {b.topic}</Text> : null}
            <View style={[s.row, { marginTop: 10 }]}>
              {["confirmada", "en_curso"].includes(b.status) && b.meetingLink && <Btn small color={C.green} title="Videollamada" onPress={() => open(b)} />}
              {b.status === "confirmada" && <Btn small title="Iniciar" onPress={() => act(b, "start")} disabled={busy} />}
              {isTutor && b.status === "en_curso" && <Btn small color={C.orange} title="Finalizar" onPress={() => act(b, "finish")} disabled={busy} />}
              {!isTutor && ["pendiente", "confirmada", "buscando", "sin_tutor"].includes(b.status) && <Btn small ghost title="Cancelar" onPress={() => act(b, "cancel")} disabled={busy} />}
              {!isTutor && b.status === "finalizada" && !b.rated && <Btn small title="Calificar" onPress={() => { setRating(b); rate.setError(null); }} />}
            </View>
          </View>
        )}
      />
      <Sheet visible={!!rating} title={`Califica a ${rating?.tutor?.name || ""}`} onClose={() => setRating(null)}>
        <View style={{ alignItems: "center", marginVertical: 8 }}><Stars value={score} onChange={setScore} /></View>
        <Field label="Comentario (opcional)" value={comment} onChangeText={setComment} multiline />
        <ErrorText error={rate.error} />
        <View style={{ height: 10 }} />
        <Btn color={C.green} title="Enviar calificación" onPress={submit} disabled={rate.busy} />
      </Sheet>
    </SafeAreaView>
  );
}

export function Notifications() {
  const { setUnread } = useAuth();
  const { data, error, loading, reload } = useLoad(() => get("/notifications"), [], 10000);
  useFocusEffect(useCallback(() => { reload(true); post("/notifications/read").then(() => setUnread(0)).catch(() => {}); }, [reload, setUnread]));
  return (
    <SafeAreaView style={s.screen} edges={["top"]}>
      <FlatList
        data={data || []} keyExtractor={(n) => String(n.id)} contentContainerStyle={s.pad}
        refreshControl={<RefreshControl refreshing={false} onRefresh={() => reload(true)} />}
        ListHeaderComponent={<View><Text style={s.h1}>Notificaciones</Text><ErrorText error={error} />{loading && !data && <Loading />}</View>}
        ListEmptyComponent={!loading ? <Empty text="No tienes notificaciones." /> : null}
        renderItem={({ item: n }) => (
          <View style={[s.card, !n.read && { borderLeftWidth: 4, borderLeftColor: C.blue2 }]}>
            <Text style={{ fontWeight: "700", color: C.text }}>{n.title}</Text><Text style={s.text}>{n.body}</Text><Text style={s.muted}>{fmtDb(n.createdAt)}</Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}
