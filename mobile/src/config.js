import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";

const mem = {};
export const store = {
  async get(k) { try { return await SecureStore.getItemAsync(k); } catch { return mem[k] ?? null; } },
  async set(k, v) { mem[k] = v; try { await SecureStore.setItemAsync(k, v); } catch { /* memoria */ } },
  async del(k) { delete mem[k]; try { await SecureStore.deleteItemAsync(k); } catch { /* memoria */ } },
};

export const DEFAULT_API = (Constants.expoConfig?.extra?.apiUrl || "http://10.0.2.2:3000").replace(/\/$/, "");
