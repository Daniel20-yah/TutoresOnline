import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View, StyleSheet, Modal as RNModal, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { STATUS } from "./api";

export const C = { blue: "#1F4E79", blue2: "#2E75B6", green: "#548235", orange: "#C55A11", red: "#C00000", bg: "#F4F7FB", line: "#DDE5EE", text: "#1d2733", muted: "#66758a" };

export const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  pad: { padding: 14 },
  card: { backgroundColor: "#fff", borderRadius: 12, borderWidth: 1, borderColor: C.line, padding: 14, marginBottom: 12 },
  h1: { fontSize: 22, fontWeight: "700", color: C.blue, marginBottom: 8 },
  h2: { fontSize: 17, fontWeight: "700", color: C.blue, marginBottom: 6 },
  text: { color: C.text, fontSize: 15 },
  muted: { color: C.muted, fontSize: 13 },
  row: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 },
  between: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  label: { fontSize: 13, fontWeight: "600", color: C.text, marginBottom: 4, marginTop: 8 },
  input: { borderWidth: 1, borderColor: C.line, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 9, fontSize: 15, backgroundColor: "#fff", color: C.text },
});

export function Btn({ title, onPress, color = C.blue2, ghost, disabled, small, style }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button"
      style={({ pressed }) => [{ backgroundColor: ghost ? "transparent" : color, borderWidth: ghost ? 1 : 0, borderColor: C.line, borderRadius: 8, paddingVertical: small ? 7 : 11, paddingHorizontal: small ? 12 : 16, opacity: disabled ? 0.5 : pressed ? 0.8 : 1, alignItems: "center" }, style]}>
      <Text style={{ color: ghost ? C.blue2 : "#fff", fontWeight: "700", fontSize: small ? 13 : 15 }}>{title}</Text>
    </Pressable>
  );
}

export function Field({ label, hint, ...p }) {
  return (<View><Text style={s.label}>{label}</Text><TextInput placeholderTextColor="#9aa7b6" style={[s.input, p.multiline && { minHeight: 70, textAlignVertical: "top" }]} {...p} />{hint ? <Text style={[s.muted, { marginTop: 2 }]}>{hint}</Text> : null}</View>);
}

export const Chip = ({ status }) => {
  const [label, color] = STATUS[status] || [status, C.muted];
  return <View style={{ backgroundColor: color + "22", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 }}><Text style={{ color, fontWeight: "700", fontSize: 12 }}>{label}</Text></View>;
};

export const Tag = ({ t }) => <View style={{ backgroundColor: "#eef4fb", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 }}><Text style={{ color: C.blue, fontSize: 12 }}>{t}</Text></View>;

export function Stars({ value = 0, onChange, count, size = 16 }) {
  const v = Math.round(value);
  return (
    <View style={s.row}>
      <View style={{ flexDirection: "row" }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <Text key={i} onPress={onChange ? () => onChange(i) : undefined} style={{ fontSize: onChange ? 34 : size, color: i <= v ? "#f2a900" : "#ccd3dc" }}>★</Text>
        ))}
      </View>
      {count !== undefined && <Text style={s.muted}>{value ? Number(value).toFixed(1) : "Nuevo"} ({count})</Text>}
    </View>
  );
}

export const ErrorText = ({ error }) => error ? <View style={{ backgroundColor: "#fde8e8", borderRadius: 8, padding: 10, marginVertical: 8 }}><Text style={{ color: "#8a1111" }}>{error.message || String(error)}</Text></View> : null;
export const OkText = ({ text }) => text ? <View style={{ backgroundColor: "#e4f3dc", borderRadius: 8, padding: 10, marginVertical: 8 }}><Text style={{ color: "#2d5a14" }}>{text}</Text></View> : null;
export const Info = ({ children, color = C.blue }) => <View style={{ backgroundColor: "#e8f1fb", borderRadius: 8, padding: 10, marginVertical: 8 }}><Text style={{ color }}>{children}</Text></View>;
export const Empty = ({ text }) => <View style={{ padding: 28, alignItems: "center" }}><Text style={s.muted}>{text}</Text></View>;
export const Loading = () => <View style={{ padding: 28 }}><ActivityIndicator color={C.blue2} /></View>;

export function Sheet({ visible, title, onClose, children }) {
  return (
    <RNModal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, backgroundColor: "rgba(10,25,45,.5)", justifyContent: "flex-end" }}>
        <View style={{ backgroundColor: "#fff", borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16, maxHeight: "90%" }}>
          <View style={s.between}><Text style={s.h2}>{title}</Text><Text onPress={onClose} style={{ fontSize: 22, color: C.muted, padding: 4 }}>✕</Text></View>
          <ScrollView keyboardShouldPersistTaps="handled">{children}<View style={{ height: 20 }} /></ScrollView>
        </View>
      </KeyboardAvoidingView>
    </RNModal>
  );
}

/** Carga con polling opcional; se pausa si la pantalla pierde el foco no es necesario en el prototipo. */
export function useLoad(fn, deps = [], pollMs = 0) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const ref = useRef(fn); ref.current = fn;
  const reload = useCallback(async (silent) => {
    if (!silent) setLoading(true);
    try { setData(await ref.current()); setError(null); } catch (e) { setError(e); }
    setLoading(false);
  }, []);
  useEffect(() => { reload(false); }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!pollMs) return undefined;
    const t = setInterval(() => reload(true), pollMs);
    return () => clearInterval(t);
  }, [pollMs, reload]);
  return { data, error, loading, reload, setData };
}

export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const run = async (fn) => { setBusy(true); setError(null); try { return await fn(); } catch (e) { setError(e); return undefined; } finally { setBusy(false); } };
  return { busy, error, run, setError };
}
