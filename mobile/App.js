import { Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "./src/auth";
import { Login, Register } from "./src/screens/Auth";
import { Search, TutorDetail, OnDemand, MyBookings, Notifications } from "./src/screens/Student";
import { Requests, Availability, Profile } from "./src/screens/Tutor";
import { Btn, C, Loading, s } from "./src/ui";

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const icon = (e) => ({ focused }) => <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>{e}</Text>;
const tabOpts = { headerShown: false, tabBarActiveTintColor: C.blue2, tabBarLabelStyle: { fontSize: 11 } };

function StudentProfile() {
  const { user, logout } = useAuth();
  return (
    <SafeAreaView style={s.screen} edges={["top"]}>
      <View style={s.pad}>
        <Text style={s.h1}>Mi cuenta</Text>
        <View style={s.card}><Text style={s.h2}>{user.name}</Text><Text style={s.muted}>{user.email}</Text></View>
        <Btn ghost title="Cerrar sesión" onPress={logout} />
      </View>
    </SafeAreaView>
  );
}

function StudentTabs() {
  const { unread } = useAuth();
  return (
    <Tab.Navigator screenOptions={tabOpts}>
      <Tab.Screen name="Buscar" component={Search} options={{ tabBarIcon: icon("🔎") }} />
      <Tab.Screen name="Inmediata" component={OnDemand} options={{ tabBarIcon: icon("⚡") }} />
      <Tab.Screen name="MisTutorias" options={{ title: "Mis tutorías", tabBarIcon: icon("📚") }}>{() => <MyBookings role="student" />}</Tab.Screen>
      <Tab.Screen name="Avisos" component={Notifications} options={{ tabBarIcon: icon("🔔"), tabBarBadge: unread > 0 ? unread : undefined }} />
      <Tab.Screen name="Cuenta" component={StudentProfile} options={{ tabBarIcon: icon("👤") }} />
    </Tab.Navigator>
  );
}

function TutorTabs() {
  const { unread } = useAuth();
  return (
    <Tab.Navigator screenOptions={tabOpts}>
      <Tab.Screen name="Solicitudes" component={Requests} options={{ tabBarIcon: icon("📥") }} />
      <Tab.Screen name="MisTutorias" options={{ title: "Mis tutorías", tabBarIcon: icon("📚") }}>{() => <MyBookings role="tutor" />}</Tab.Screen>
      <Tab.Screen name="Horarios" component={Availability} options={{ tabBarIcon: icon("🗓️") }} />
      <Tab.Screen name="Avisos" component={Notifications} options={{ tabBarIcon: icon("🔔"), tabBarBadge: unread > 0 ? unread : undefined }} />
      <Tab.Screen name="Perfil" component={Profile} options={{ tabBarIcon: icon("👤") }} />
    </Tab.Navigator>
  );
}

function AdminNotice() {
  const { logout } = useAuth();
  return (
    <SafeAreaView style={s.screen}>
      <View style={[s.pad, { flex: 1, justifyContent: "center" }]}>
        <View style={s.card}>
          <Text style={s.h1}>Administrador</Text>
          <Text style={s.text}>El panel de administración (verificar tutores, moderar calificaciones, estadísticas) está disponible en la versión web.</Text>
          <View style={{ height: 14 }} /><Btn title="Cerrar sesión" onPress={logout} />
        </View>
      </View>
    </SafeAreaView>
  );
}

function Root() {
  const { user, booting } = useAuth();
  if (booting) return <View style={[s.screen, { justifyContent: "center" }]}><Loading /></View>;
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerTintColor: "#fff", headerStyle: { backgroundColor: C.blue } }}>
        {!user ? (<>
          <Stack.Screen name="Login" component={Login} options={{ headerShown: false }} />
          <Stack.Screen name="Register" component={Register} options={{ title: "Registro" }} />
        </>) : user.role === "student" ? (<>
          <Stack.Screen name="Tabs" component={StudentTabs} options={{ headerShown: false }} />
          <Stack.Screen name="TutorDetail" component={TutorDetail} options={({ route }) => ({ title: route.params?.name || "Tutor" })} />
        </>) : user.role === "tutor" ? (
          <Stack.Screen name="Tabs" component={TutorTabs} options={{ headerShown: false }} />
        ) : (
          <Stack.Screen name="Admin" component={AdminNotice} options={{ headerShown: false }} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="auto" />
        <Root />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
