/**
 * @jest-environment node
 *
 * The security store: lock/unlock, app-lock toggle, and idle-timeout state.
 *
 * These tests verify the pure state transitions — the same ones exercised in
 * the browser when AppState fires in `_layout.jsx`. They do not touch
 * `expo-local-authentication`, which is a native module with no jest binding.
 */

const secureStoreMock = require("./support/expoSecureStoreMock");

const { useSecurityStore, IDLE_TIMEOUT_MS } = require("../store/security");

beforeEach(() => {
  secureStoreMock.__reset();
  useSecurityStore.setState({
    appLockEnabled: false,
    biometricsEnabled: false,
    isLocked: false,
    lockReason: null,
    lastActiveAt: null,
  });
});

describe("initial state", () => {
  test("starts unlocked with no settings", () => {
    const state = useSecurityStore.getState();
    expect(state.isLocked).toBe(false);
    expect(state.appLockEnabled).toBe(false);
    expect(state.biometricsEnabled).toBe(false);
  });

  test("idle timeout is 5 minutes", () => {
    expect(IDLE_TIMEOUT_MS).toBe(5 * 60 * 1000);
  });
});

describe("lock and unlock", () => {
  test("lock sets isLocked and records the reason", () => {
    useSecurityStore.getState().lock("idle");
    const state = useSecurityStore.getState();
    expect(state.isLocked).toBe(true);
    expect(state.lockReason).toBe("idle");
  });

  test("unlock clears the lock and resets lastActiveAt", () => {
    useSecurityStore.getState().lock("idle");
    jest.spyOn(Date, "now").mockReturnValue(1000);
    useSecurityStore.getState().unlock();

    const state = useSecurityStore.getState();
    expect(state.isLocked).toBe(false);
    expect(state.lockReason).toBe(null);
    expect(state.lastActiveAt).toBe(1000);
  });
});

describe("app lock toggle", () => {
  test("enables app lock", async () => {
    await useSecurityStore.getState().setAppLockEnabled(true);
    expect(useSecurityStore.getState().appLockEnabled).toBe(true);
  });

  test("disables app lock and biometrics together", async () => {
    await useSecurityStore.getState().setAppLockEnabled(true);
    await useSecurityStore.getState().setBiometricsEnabled(true);
    await useSecurityStore.getState().setAppLockEnabled(false);

    const state = useSecurityStore.getState();
    expect(state.appLockEnabled).toBe(false);
    expect(state.biometricsEnabled).toBe(false);
  });

  test("persists settings across store reset", async () => {
    await useSecurityStore.getState().setAppLockEnabled(true);
    await useSecurityStore.getState().setBiometricsEnabled(true);

    // Simulate cold start: wipe in-memory state, re-hydrate from storage.
    useSecurityStore.setState({
      appLockEnabled: false,
      biometricsEnabled: false,
    });
    await useSecurityStore.getState().hydrate();

    const state = useSecurityStore.getState();
    expect(state.appLockEnabled).toBe(true);
    expect(state.biometricsEnabled).toBe(true);
  });
});

describe("touch", () => {
  test("records the current time as lastActiveAt", () => {
    jest.spyOn(Date, "now").mockReturnValue(5000);
    useSecurityStore.getState().touch();
    expect(useSecurityStore.getState().lastActiveAt).toBe(5000);
  });
});

describe("idle timeout edge", () => {
  test("IDLE_TIMEOUT_MS is a positive number", () => {
    expect(IDLE_TIMEOUT_MS).toBeGreaterThan(0);
    expect(IDLE_TIMEOUT_MS).toBe(300000);
  });
});
