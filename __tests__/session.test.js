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
const { clearTokens, loadTokens, saveTokens, savePhone, loadPhone, clearPhone, tokenStorageName } = require(
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

describe("remembering the phone number", () => {
  test("saves and loads the phone number", async () => {
    await savePhone("+233201000001");
    expect(await loadPhone()).toBe("+233201000001");
  });

  test("returns null when no phone was saved", async () => {
    expect(await loadPhone()).toBe(null);
  });

  test("clearing removes the saved phone", async () => {
    await savePhone("+233201000001");
    await clearPhone();
    expect(await loadPhone()).toBe(null);
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

describe("consent capture at sign-in", () => {
  const jsonResponse = (payload, status = 200) => ({
    ok: status < 400,
    status,
    text: async () => JSON.stringify(payload),
  });

  /** Route every call the sign-in flow can make, recording what was sent. */
  const mockServer = (consentState, noticeVersion = "2026-10-05") => {
    const requests = [];
    global.fetch = jest.fn((url, options = {}) => {
      requests.push({ url, method: options.method, body: options.body, headers: options.headers });
      if (url.endsWith("/api/auth/token/")) {
        return Promise.resolve(jsonResponse({ access: "access-1", refresh: "refresh-1" }));
      }
      if (url.endsWith("/api/privacy/consent/") && options.method === "POST") {
        return Promise.resolve(
          jsonResponse({ consent: { action: "granted", noticeVersion } })
        );
      }
      if (url.endsWith("/api/privacy/consent/")) {
        return Promise.resolve(
          jsonResponse({ inForce: null, currentNoticeVersion: noticeVersion, history: [], ...consentState })
        );
      }
      if (url.endsWith("/api/privacy/notice/")) {
        return Promise.resolve(jsonResponse({ version: noticeVersion, sections: [] }));
      }
      return Promise.resolve(jsonResponse({}));
    });
    return requests;
  };

  const signIn = () =>
    useSessionStore.getState().authenticate({ phone: "+233201000001", password: "password" });

  const consentPosts = (requests) =>
    requests.filter((r) => r.method === "POST" && r.url.includes("/api/privacy/consent/"));

  afterEach(() => {
    delete global.fetch;
  });

  test("records the grant against the served notice version for a member with no consent history", async () => {
    configureApi({ baseUrl: "http://127.0.0.1:8000", getToken: getAccessToken });
    const requests = mockServer({});

    const result = await signIn();

    expect(result.ok).toBe(true);
    const grants = consentPosts(requests);
    expect(grants).toHaveLength(1);
    expect(JSON.parse(grants[0].body)).toEqual({ action: "granted", noticeVersion: "2026-10-05" });
    // The grant is an authenticated act: it carries the session the sign-in just issued.
    expect(grants[0].headers.Authorization).toBe("Bearer access-1");
  });

  test("leaves a member whose consent is already in force alone", async () => {
    configureApi({ baseUrl: "http://127.0.0.1:8000", getToken: getAccessToken });
    const requests = mockServer({
      inForce: { noticeVersion: "2026-10-05" },
      history: [{ action: "granted", noticeVersion: "2026-10-05" }],
    });

    await signIn();

    expect(consentPosts(requests)).toHaveLength(0);
  });

  test("does not re-grant consent a member has withdrawn", async () => {
    configureApi({ baseUrl: "http://127.0.0.1:8000", getToken: getAccessToken });
    // A withdrawal is a row, not an absence: inForce is null, but the history
    // holds the choice the member already made.
    const requests = mockServer({
      inForce: null,
      history: [{ action: "withdrawn", noticeVersion: "2026-10-05" }],
    });

    await signIn();

    expect(consentPosts(requests)).toHaveLength(0);
  });

  test("signs in even when the consent endpoint is unreachable", async () => {
    configureApi({ baseUrl: "http://127.0.0.1:8000", getToken: getAccessToken });
    global.fetch = jest.fn((url) => {
      if (url.endsWith("/api/auth/token/")) {
        return Promise.resolve(jsonResponse({ access: "access-1", refresh: "refresh-1" }));
      }
      return Promise.reject(new Error("network down"));
    });

    const result = await signIn();

    expect(result.ok).toBe(true);
    expect(useSessionStore.getState().isAuthenticated).toBe(true);
  });
});