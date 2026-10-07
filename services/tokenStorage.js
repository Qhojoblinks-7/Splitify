/**
 * Where the session token is kept between launches.
 *
 * `expo-secure-store` is backed by the iOS keychain and Android's encrypted preferences, so a
 * token at rest is not readable from a device backup. Plain `AsyncStorage` is, which is why it
 * is not used here: a refresh token recovered from a backup is a session recovered by whoever
 * made the backup. I23.
 *
 * SecureStore is a native module, so it is unavailable in Expo Go and until the app is rebuilt
 * as a development build. Rather than crash, or silently drop the token on a platform that
 * could have kept it, availability is probed once and the result decides where the token
 * lives. The fallback is memory, which means the member signs in again after a cold start —
 * inconvenient, and the safe way to fail.
 */

import * as SecureStore from "expo-secure-store";

const ACCESS_KEY = "growl.session.access";
const REFRESH_KEY = "growl.session.refresh";
const PHONE_KEY = "growl.session.phone";

let backend = null;

/** Resolve the storage backend once. Memory is the fallback and the always-available floor. */
async function resolveBackend() {
  if (backend) return backend;

  try {
    const available = await SecureStore.isAvailableAsync();
    backend = available
      ? {
          name: "secure-store",
          write: (key, value) => SecureStore.setItemAsync(key, value),
          read: (key) => SecureStore.getItemAsync(key),
          wipe: (key) => SecureStore.deleteItemAsync(key),
        }
      : memoryBackend();
  } catch {
    // A native module that throws on load is indistinguishable from one that is absent, and
    // both mean the same thing here: we cannot keep a token durably.
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
    wipe: async (key) => void held.delete(key),
  };
}

/**
 * Whether a token survives a restart on this build.
 *
 * Worth surfacing rather than hiding: it tells us whether a member signing out and back in is
 * working correctly or is about to be asked for their password for no reason.
 */
export async function tokenStorageName() {
  return (await resolveBackend()).name;
}

export async function saveTokens({ access, refresh }) {
  const store = await resolveBackend();
  if (access) await store.write(ACCESS_KEY, access);
  if (refresh) await store.write(REFRESH_KEY, refresh);
}

export async function loadTokens() {
  const store = await resolveBackend();
  const [access, refresh] = await Promise.all([store.read(ACCESS_KEY), store.read(REFRESH_KEY)]);
  return { access: access ?? null, refresh: refresh ?? null };
}

export async function clearTokens() {
  const store = await resolveBackend();
  await Promise.all([store.wipe(ACCESS_KEY), store.wipe(REFRESH_KEY)]);
}

/**
 * Remember the phone number after registration so the Login screen can pre-fill it.
 *
 * Deliberately NOT cleared on sign-out: a member signing out is not deleting their
 * account, and being asked for the identifier again adds friction. The phone number
 * is not sensitive enough to require key-chain storage; the memory fallback covers
 * devices without SecureStore.
 */
export async function savePhone(phone) {
  const store = await resolveBackend();
  await store.write(PHONE_KEY, phone);
}

export async function loadPhone() {
  const store = await resolveBackend();
  return store.read(PHONE_KEY);
}

export async function clearPhone() {
  const store = await resolveBackend();
  await store.wipe(PHONE_KEY);
}