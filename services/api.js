/**
 * The only place in the app that performs HTTP.
 *
 * One wrapper, and no caller may pass a URL. Every request is a path appended to a base URL
 * this module owns, which removes an entire class of bug: a caller cannot send a member's
 * token, or a payment, to somewhere it should not go. That is the whole blast radius of the
 * 2026 axios SSRF advisories, and it is structurally impossible here rather than a thing to
 * remember.
 *
 * Also owned here, because getting any of it wrong per-caller is how money goes missing:
 *
 *   timeout      `fetch` has none. A request with no deadline hangs the queue behind it.
 *   auth header  added in one place. A caller cannot forget it or send the wrong token.
 *   idempotency  attachable per write. The offline queue replays what it cannot confirm, and
 *                a replay that is not idempotent becomes a second cedi.
 *   error shape  one error class, so a caller distinguishes "refused" from "offline" without
 *                pattern-matching on a status code.
 *
 * Axios is deliberately absent: eight CVEs in 2026, including a CVSS 10.0 SSRF and a
 * prototype-pollution gadget that silently rewrote JSON responses. The platform `fetch` has
 * no supply chain at all.
 */

const DEFAULT_BASE_URL = "http://127.0.0.1:8000";
const DEFAULT_TIMEOUT_MS = 15000;

let baseUrl = DEFAULT_BASE_URL;
let readToken = () => null;
let onUnauthorized = () => {};

/**
 * An HTTP failure the caller can act on.
 *
 * `refused` means the server understood the request and said no: a frozen slot, a duplicate
 * reference, an amount out of range. That is an answer to show the member, not an error to
 * retry. `offline` means the request never got an answer, and the caller may safely try again
 * later. Conflating the two is how a group ends up retrying a payment that was already
 * recorded.
 */
export class ApiError extends Error {
  constructor(message, { status = 0, code = "unknown", detail = null, errors = null, url = null, cause = null } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.detail = detail;
    this.errors = errors;
    this.url = url;
    this.cause = cause;
    this.offline = status === 0;
    this.refused = status >= 400 && status < 500;
  }
}

/**
 * Point the client at a server and give it a way to read the current token.
 *
 * The session layer installs these at sign-in. Keeping them here rather than in a config file
 * means the token is read at request time, so a refresh never leaves a stale copy baked into
 * a closure.
 */
export function configureApi({ baseUrl: next = baseUrl, getToken, onUnauthorized: handler } = {}) {
  if (next !== undefined) {
    if (typeof next !== "string" || !/^https?:\/\//.test(next)) {
      throw new Error(`An API base URL must be an http(s) origin, received ${String(next)}`);
    }
    baseUrl = next.replace(/\/+$/, "");
  }
  if (typeof getToken === "function") readToken = getToken;
  if (typeof handler === "function") onUnauthorized = handler;
  return { baseUrl };
}

export function currentBaseUrl() {
  return baseUrl;
}

/**
 * Join a caller-supplied path to the base URL, refusing anything that could leave it.
 *
 * A leading `//host` or a `http://` prefix is the whole attack: it turns a relative path into
 * an absolute request to somebody else's server, carrying our auth header with it.
 */
export function resolveUrl(path) {
  if (typeof path !== "string" || !path.startsWith("/")) {
    throw new ApiError(`API paths must be relative and start with "/", received ${String(path)}`, {
      code: "invalid_path",
    });
  }
  if (path.startsWith("//")) {
    throw new ApiError("An API path may not start with //", { code: "invalid_path" });
  }
  return `${baseUrl}${path}`;
}

async function readBody(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    // A non-JSON body from a server that should only speak JSON is a fault worth surfacing
    // rather than an empty object a caller will misread as "no data".
    throw new ApiError("The server returned a response that was not JSON", {
      status: response.status,
      code: "malformed_response",
      detail: text.slice(0, 200),
    });
  }
}

/**
 * Perform one API request.
 *
 * `idempotencyKey` is sent as a header rather than folded into the body, so the server can
 * deduplicate a replayed write without having to interpret the payload.
 */
export async function apiFetch(path, options = {}) {
  const {
    method = "GET",
    body,
    idempotencyKey,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    signal: callerSignal,
  } = options;

  const url = resolveUrl(path);
  const token = readToken();

  const headers = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;

  // One deadline for our own timeout, chained to the caller's signal so a screen that unmounts
  // cancels its request instead of leaving it to finish into nothing.
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  const signal = callerSignal
    ? AbortSignal.any([callerSignal, timeoutSignal])
    : timeoutSignal;

  let response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (cause) {
    if (callerSignal?.aborted) throw cause;
    // `typeof` rather than a bare reference: `__DEV__` is injected by React Native and is simply
    // absent under Node, so reading it directly would throw a ReferenceError here and mask the
    // unreachable-server error this branch exists to raise.
    if (typeof __DEV__ !== "undefined" && __DEV__) {
      console.warn(`[api] ${method} ${url} unreachable:`, cause?.message ?? cause);
    }
    throw new ApiError("Could not reach the server", {
      code: "offline",
      status: 0,
      url,
      cause,
    });
  }

  if (response.status === 401) {
    onUnauthorized();
  }

  if (!response.ok) {
    const payload = (await readBody(response)) || {};
    const detail =
      typeof payload.detail === "string"
        ? payload.detail
        : Object.values(payload)
            .flat()
            .map((entry) => (typeof entry === "string" ? entry : JSON.stringify(entry)))
            .join(" ") || `Request failed with ${response.status}`;

    throw new ApiError(detail, {
      status: response.status,
      code: response.status === 401 ? "unauthorized" : "refused",
      detail: payload.detail ?? null,
      errors: payload,
    });
  }

  return readBody(response);
}

export default apiFetch;