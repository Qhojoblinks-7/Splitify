/**
 * Signing in, and the token every request carries.
 *
 * Kept apart from `services/query.js` on purpose. TanStack Query is a cache for server state;
 * a token is neither server state nor a cache, and importing the query client to obtain one
 * drags React's data layer into the session store, the login screen and every test that
 * touches either. Two functions that do not need the cache should not sit behind it.
 */

import { ApiError, apiFetch, configureApi } from "./api";

let accessToken = null;

/** Hand the current access token to the API wrapper, which reads it per request. */
export function setAccessToken(token) {
  accessToken = token;
  return token;
}

export function getAccessToken() {
  return accessToken;
}

/**
 * Point the API wrapper at a server and at the token this module holds.
 *
 * Called once at app start, so a token refresh never leaves a stale copy baked into a closure
 * anywhere.
 */
export function installApi({ baseUrl, onUnauthorized } = {}) {
  return configureApi({
    baseUrl,
    getToken: getAccessToken,
    onUnauthorized,
  });
}

/**
 * Exchange credentials for a session.
 *
 * Returns `{ access, refresh }`, which is what the session store persists. Lives here rather
 * than in a screen so the whole flow, including the token handoff, is testable.
 *
 * The token is put in front of the API wrapper before it is returned: the caller stores it and
 * then navigates, and a screen that issues a request in between must not send an empty auth
 * header.
 */
export async function signIn({ phone, password }) {
  const session = await apiFetch("/api/auth/token/", {
    method: "POST",
    body: { phone, password },
  });
  setAccessToken(session.access);
  return { access: session.access, refresh: session.refresh };
}

/**
 * Register a new account and receive tokens in one call.
 *
 * The server validates the phone number, runs Django's password validators,
 * creates the Account, and returns JWT tokens. The client stores them and
 * records consent — the same post-sign-up path `signIn` uses.
 */
export async function signUp({ phone, email, password }) {
  const session = await apiFetch("/api/auth/register/", {
    method: "POST",
    body: { phone, email, password },
  });
  setAccessToken(session.access);
  return { access: session.access, refresh: session.refresh };
}

export { ApiError };