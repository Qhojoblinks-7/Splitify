/**
 * App lock and idle-timeout state.
 *
 * A fintech app that shows balances, payment history, and contribution ledgers
 * must not stay open on an unattended screen. Two controls live here:
 *
 * 1. Idle timeout — tracked via AppState in `app/_layout.jsx`. When the app
 *    returns to the foreground after being backgrounded for longer than
 *    `IDLE_TIMEOUT_MS`, the member is shown a biometric/PIN unlock screen.
 *
 * 2. App lock toggle — the member can turn biometric re-auth on or off from
 *    `app/Security.jsx`. When off, the idle timeout still fires after
 *    `IDLE_TIMEOUT_MS` but the member is returned to the login screen instead
 *    of an in-app unlock prompt.
 *
 * 3. Biometric re-auth — when the member enables app lock, the unlock screen
 *    uses `expo-local-authentication` if the device supports it. No biometric
 *    data ever reaches the app: the module returns a boolean only.
 *
 * The settings (appLockEnabled, biometricsEnabled) are persisted via secure-store,
 * the same backend `tokenStorage.js` uses for session tokens. The lock state
 * itself (isLocked, lockReason) is transient and lives only in memory, because a
 * cold start should re-evaluate whether the timeout has elapsed rather than
 * trust a flag written by a previous process.
 */

import { create } from "zustand";
import * as SecureStore from "expo-secure-store";

export const IDLE_TIMEOUT_MS = 5 * 60 * 1000;

export const LOCK_REASONS = {
  IDLE: "idle",
  TOKEN_EXPIRED: "token_expired",
};

const SETTINGS_KEY = "ntuboa.security";

let backend = null;

async function resolveBackend() {
  if (backend) return backend;
  try {
    const available = await SecureStore.isAvailableAsync();
    backend = available
      ? {
          name: "secure-store",
          write: (key, value) => SecureStore.setItemAsync(key, value),
          read: (key) => SecureStore.getItemAsync(key),
        }
      : memoryBackend();
  } catch {
    backend = memoryBackend();
  }
  return backend;
}

function memoryBackend() {
  const held = new Map();
  return {
    name: "memory",
    write: async (key, value) => void held.set(key, value),
    read: async (key) => held.get(key) ?? null,
  };
}

async function loadSettings() {
  const store = await resolveBackend();
  const raw = await store.read(SETTINGS_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function saveSettings(settings) {
  const store = await resolveBackend();
  await store.write(SETTINGS_KEY, JSON.stringify(settings));
}

export const useSecurityStore = create((set, get) => ({
  appLockEnabled: false,
  biometricsEnabled: false,
  isLocked: false,
  lockReason: null,
  lastActiveAt: null,

  hydrate: async () => {
    const settings = await loadSettings();
    if (settings) {
      set({
        appLockEnabled: settings.appLockEnabled ?? false,
        biometricsEnabled: settings.biometricsEnabled ?? false,
      });
    }
  },

  setAppLockEnabled: async (enabled) => {
    const biometrics = enabled ? get().biometricsEnabled : false;
    set({ appLockEnabled: enabled, biometricsEnabled: biometrics });
    await saveSettings({ appLockEnabled: enabled, biometricsEnabled: biometrics });
  },

  setBiometricsEnabled: async (enabled) => {
    set({ biometricsEnabled: enabled });
    await saveSettings({ appLockEnabled: get().appLockEnabled, biometricsEnabled: enabled });
  },

  lock: (reason = LOCK_REASONS.IDLE) => {
    set({ isLocked: true, lockReason: reason });
  },

  unlock: () => {
    set({ isLocked: false, lockReason: null, lastActiveAt: Date.now() });
  },

  touch: () => {
    set({ lastActiveAt: Date.now() });
  },

  reset: () => {
    set({ isLocked: false, lockReason: null, lastActiveAt: null });
  },
}));

export default useSecurityStore;
