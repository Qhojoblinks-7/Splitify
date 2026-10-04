/**
 * Stand-in for `expo-secure-store` under jest.
 *
 * SecureStore is a native module backed by the iOS keychain and Android's encrypted
 * preferences. There is nothing to talk to in a node test environment, and a unit test that
 * fails because a native binding is missing is testing the wrong thing.
 *
 * Backed by a Map, so it behaves like real storage within a test — which means the session
 * store's persistence logic is genuinely exercised, not stubbed out to a no-op that would hide
 * a token that is written but never read back.
 */

const held = new Map();

module.exports = {
  isAvailableAsync: async () => true,
  setItemAsync: async (key, value) => {
    held.set(key, value);
  },
  getItemAsync: async (key) => (held.has(key) ? held.get(key) : null),
  deleteItemAsync: async (key) => {
    held.delete(key);
  },
  /** Not part of the real API. Lets a test start from a clean, known state. */
  __reset: () => held.clear(),
};