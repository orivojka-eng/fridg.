import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

/**
 * Access + refresh tokens live in the device keychain / keystore
 * (expo-secure-store). On web (dev only) they fall back to memory.
 */
const ACCESS_KEY = 'fridgr.access';
const REFRESH_KEY = 'fridgr.refresh';

let memory: Record<string, string | null> = {};
const secure = Platform.OS !== 'web';

async function read(key: string) {
  if (!secure) return memory[key] ?? null;
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

async function write(key: string, value: string | null) {
  if (!secure) {
    memory[key] = value;
    return;
  }
  try {
    if (value) await SecureStore.setItemAsync(key, value, { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK });
    else await SecureStore.deleteItemAsync(key);
  } catch {
    /* keychain unavailable: session simply will not persist */
  }
}

export const tokenStore = {
  getAccess: () => read(ACCESS_KEY),
  getRefresh: () => read(REFRESH_KEY),
  set: async (access: string, refresh: string) => {
    await Promise.all([write(ACCESS_KEY, access), write(REFRESH_KEY, refresh)]);
  },
  clear: async () => {
    memory = {};
    await Promise.all([write(ACCESS_KEY, null), write(REFRESH_KEY, null)]);
  },
};
