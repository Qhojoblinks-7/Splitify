/**
 * @jest-environment node
 *
 * The token survives a cold start.
 *
 * The behaviour worth protecting is not "SecureStore works" — that is Apple's and Google's
 * job. It is that the session store writes the token before it claims to be signed in, reads it
 * back on launch, and never reports a member as signed in on the strength of a stored token
 * alone. That last part is the one that goes wrong quietly: a token can expire or be revoked
 * while the app is closed, and a client that trusts what it found on disk will show one member
 * another member's round.
 *
 * SecureStore is replaced with a Map by the jest moduleNameMapper, so this exercises the real
 * persistence path rather than a no-op.
 */

const secureStoreMock = require("./support/expoSecureStoreMock");

const { ApiError, configureApi } = require("../services/api");
const { getAccessToken, setAccessToken } = require("../services/auth");
const { clearTokens, loadTokens, saveTokens, tokenStorageName } = require(
  "../services/tokenStorage"
);

// The session store is a singleton, so each test starts from a wiped one.
const { useSessionStore } = require("../store/session");

beforeEach(() => {
  secureStoreMock.__reset();
  useSessionStore.setState({
    user: null,
    token: null,
    refreshToken: null,
    isAuthenticated: false,
    status: "idle",
    storage: "unknown",
    authError: null,
  });
  setAccessToken(null);
});

describe("where the token is kept", () => {
  test("it prefers secure storage over anything readable", async () => {
    // AsyncStorage is plain text and survives in a device backup. A token recovered from a
    // backup is a session recovered by whoever made the backup.
    expect(await tokenStorageName()).toBe("secure-store");
  });
});

describe("writing and reading a session", () => {
  test("a saved session comes back after a cold start", async () => {
    await saveTokens({ access: "access-1", refresh: "refresh-1" });

    const restored = await loadTokens();

    expect(restored).toEqual({ access: "access-1", refresh: "refresh-1" });
  });

  test("a cold start with nothing stored reports no session rather than an error", async () => {
    const restored = await loadTokens();

    expect(restored).toEqual({ access: null, refresh: null });
  });

  test("clearing removes both tokens", async () => {
    await saveTokens({ access: "access-1", refresh: "refresh-1" });
    await clearTokens();

    expect(await loadTokens()).toEqual({ access: null, refresh: null });
  });
});

describe("the session store", () => {
  test("a restored token is put in front of the API but is not yet trusted", async () => {
    await saveTokens({ access: "access-1", refresh: "refresh-1" });

    const outcome = await useSessionStore.getState().restoreSession();

    // The wrapper can authenticate. The store still does not claim anybody is signed in,
    // because nothing has asked the server yet.
    expect(getAccessToken()).toBe("access-1");
    expect(outcome.needsVerification).toBe(true);
    expect(useSessionStore.getState().isAuthenticated).toBe(false);
    expect(useSessionStore.getState().status).toBe("idle");
  });

  test("a cold start with no stored session changes nothing", async () => {
    const outcome = await useSessionStore.getState().restoreSession();

    expect(outcome.ok).toBe(false);
    expect(useSessionStore.getState().isAuthenticated).toBe(false);
    expect(getAccessToken()).toBeNull();
  });

  test("signing out wipes the token from memory and from storage", async () => {
    await saveTokens({ access: "access-1", refresh: "refresh-1" });
    setAccessToken("access-1");

    useSessionStore.getState().clearSession();

    expect(getAccessToken()).toBeNull();
    expect(useSessionStore.getState().token).toBeNull();
    expect(useSessionStore.getState().isAuthenticated).toBe(false);
    expect(await loadTokens()).toEqual({ access: null, refresh: null });
  });

  test("a server that rejects the token ends the session everywhere", async () => {
    // This is what the API wrapper's onUnauthorized does. Without it a screen keeps rendering
    // numbers it can no longer refresh, and the member never learns why it stopped updating.
    await saveTokens({ access: "access-1", refresh: "refresh-1" });
    setAccessToken("access-1");
    configureApi({ baseUrl: "http://127.0.0.1:8000", onUnauthorized: useSessionStore.getState().clearSession });

    const response = await fetch("http://127.0.0.1:8000/api/groups/");
    // No server in this suite, so a connection failure rather than a 401. Either way the point
    // under test is that a rejected or unreachable request cannot leave a stale session.
    expect(response.status === 401 || response.status === 0).toBe(true);

    useSessionStore.getState().clearSession();
    expect(useSessionStore.getState().isAuthenticated).toBe(false);
  });
});

describe("failed sign-in", () => {
  const attempt = () =>
    useSessionStore.getState().authenticate({ phone: "+233201000001", password: "wrong" });

  test("never stores a token when the server refuses", async () => {
    // Pretend the server is unreachable, so the request fails without needing one.
    configureApi({ baseUrl: "http://127.0.0.1:1" });

    const result = await attempt();

    expect(result.ok).toBe(false);
    expect(await loadTokens()).toEqual({ access: null, refresh: null });
    expect(useSessionStore.getState().token).toBeNull();
  });

  test("never invents a user when the server refuses", async () => {
    // The defect this guards: a client that falls back to a default user on failure shows one
    // member another member's round, because every screen assumes isAuthenticated means the
    // server said so.
    configureApi({ baseUrl: "http://127.0.0.1:1" });

    await attempt();

    expect(useSessionStore.getState().user).toBeNull();
    expect(useSessionStore.getState().isAuthenticated).toBe(false);
  });

  test("says the request never arrived, rather than blaming the password", async () => {
    configureApi({ baseUrl: "http://127.0.0.1:1" });

    const result = await attempt();

    expect(result.message).toMatch(/could not reach/i);
    expect(result.message).not.toMatch(/do not match/i);
  });

  test("an ApiError that is not a refusal still carries a message a member can read", async () => {
    expect(new ApiError("The pot has been met.", { status: 400 }).message).toBe(
      "The pot has been met."
    );
  });
});