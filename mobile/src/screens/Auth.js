import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../auth";
import { get, getBase, saveBase } from "../api";
import { Btn, C, ErrorText, Field, Info, OkText, s, useAction } from "../ui";

const DEMO = [["Estudiante", "estudiante@demo.co"], ["Tutor (Laura)", "laura@demo.co"], ["Tutor (Carlos)", "carlos@demo.co"]];

export function Login({ navigation }) {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [server, setServer] = useState(getBase());
  const [conn, setConn] = useState("");
  const { busy, error, run } = useAction();
  const test = useAction();
  useEffect(() => setServer(getBase()), []);

  const testConn = () => test.run(async () => { setConn(""); await saveBase(server); setServer(getBase()); const h = await get("/health"); setConn(`Conectado: ${h.service}`); });
  const enter = () => run(async () => { await saveBase(server); await login(email.trim(), password); });

  return (
    <SafeAreaView style={s.screen}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.pad} keyboardShouldPersistTaps="handled">
          <View style={{ backgroundColor: C.blue, borderRadius: 14, padding: 18, marginBottom: 14 }}>
            <Text style={{ color: "#fff", fontSize: 26, fontWeight: "800" }}>🎓 TutoresOn-Line</Text>
            <Text style={{ color: "#dbe9f7", marginTop: 4 }}>Tutores verificados o ayuda inmediata.</Text>
          </View>
          <View style={s.card}>
            <Text style={s.h2}>Iniciar sesión</Text>
            <Field label="Correo" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
            <Field label="Contraseña" value={password} onChangeText={setPassword} secureTextEntry />
            <ErrorText error={error} />
            <View style={{ height: 10 }} />
            <Btn title={busy ? "Entrando…" : "Entrar"} onPress={enter} disabled={busy} />
            <Text style={[s.muted, { textAlign: "center", marginTop: 12 }]} onPress={() => navigation.navigate("Register")}>¿No tienes cuenta? <Text style={{ color: C.blue2, fontWeight: "700" }}>Regístrate</Text></Text>
          </View>
          <View style={s.card}>
            <Text style={s.h2}>Cuentas de demostración</Text>
            <Text style={s.muted}>Clave: demo1234</Text>
            <View style={[s.row, { marginTop: 8 }]}>{DEMO.map(([l, e]) => <Btn key={e} small ghost title={l} onPress={() => { setEmail(e); setPassword("demo1234"); }} />)}</View>
          </View>
          <View style={s.card}>
            <Text style={s.h2}>Servidor</Text>
            <Field label="URL de la API" value={server} onChangeText={setServer} autoCapitalize="none" autoCorrect={false} hint="Ej: https://tutoresonline.onrender.com (emulador Android local: http://10.0.2.2:3000)" />
            <ErrorText error={test.error} /><OkText text={conn} />
            <View style={{ height: 8 }} />
            <Btn ghost small title={test.busy ? "Probando…" : "Probar conexión"} onPress={testConn} disabled={test.busy} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function Register({ navigation }) {
  const { register } = useAuth();
  const [f, setF] = useState({ role: "student", name: "", email: "", password: "", subjects: "", levels: "", modality: "ambas", price: "30000", city: "Barranquilla", education: "", bio: "" });
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));
  const { busy, error, run } = useAction();
  const list = (t) => t.split(",").map((x) => x.trim()).filter(Boolean);
  const submit = () => run(async () => {
    const body = { name: f.name.trim(), email: f.email.trim(), password: f.password, role: f.role };
    if (f.role === "tutor") body.tutor = { subjects: list(f.subjects), levels: list(f.levels), modality: f.modality, pricePerHour: Number(f.price), city: f.city, education: f.education, bio: f.bio };
    await register(body);
  });
  const Seg = ({ items, value, onChange }) => <View style={[s.row, { marginTop: 4 }]}>{items.map(([v, l]) => <Btn key={v} small ghost={value !== v} title={l} onPress={() => onChange(v)} />)}</View>;
  return (
    <SafeAreaView style={s.screen}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.pad} keyboardShouldPersistTaps="handled">
          <View style={s.card}>
            <Text style={s.h1}>Crear cuenta</Text>
            <Seg items={[["student", "Soy estudiante"], ["tutor", "Soy tutor"]]} value={f.role} onChange={set("role")} />
            <Field label="Nombre completo" value={f.name} onChangeText={set("name")} />
            <Field label="Correo" value={f.email} onChangeText={set("email")} autoCapitalize="none" keyboardType="email-address" />
            <Field label="Contraseña" value={f.password} onChangeText={set("password")} secureTextEntry hint="Mínimo 6 caracteres" />
            {f.role === "tutor" && (<>
              <Info>Tu perfil será revisado por el administrador antes de aparecer en las búsquedas.</Info>
              <Field label="Materias" value={f.subjects} onChangeText={set("subjects")} hint="Separadas por coma. Ej: Python, Cálculo" />
              <Field label="Niveles" value={f.levels} onChangeText={set("levels")} />
              <Text style={s.label}>Modalidad</Text>
              <Seg items={[["ambas", "Ambas"], ["virtual", "Virtual"], ["presencial", "Presencial"]]} value={f.modality} onChange={set("modality")} />
              <Field label="Precio por hora (COP)" value={f.price} onChangeText={set("price")} keyboardType="numeric" />
              <Field label="Ciudad" value={f.city} onChangeText={set("city")} />
              <Field label="Formación académica" value={f.education} onChangeText={set("education")} />
              <Field label="Presentación" value={f.bio} onChangeText={set("bio")} multiline />
            </>)}
            <ErrorText error={error} />
            <View style={{ height: 10 }} />
            <Btn title={busy ? "Creando…" : "Crear cuenta"} onPress={submit} disabled={busy} />
            <Text style={[s.muted, { textAlign: "center", marginTop: 12 }]} onPress={() => navigation.goBack()}>¿Ya tienes cuenta? <Text style={{ color: C.blue2, fontWeight: "700" }}>Inicia sesión</Text></Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
