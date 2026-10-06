/**
 * TanStack Query: the app's server-state layer.
 *
 * A round is owned by the backend. It is not client state, and holding a copy of it in a
 * zustand store is what produces a group screen showing a total that contradicts the number
 * beside it. So server data lives here, and only what is genuinely the device's concern — the
 * offline queue, connectivity, the session — lives in stores.
 *
 * The definitions are exported separately from the hooks on purpose. A hook needs React; a
 * query definition does not. That lets the integration tests exercise the exact functions the
 * app uses, through the real cache, retry and de-duplication machinery, with no component and
 * no renderer. What the tests verify is what the app does.
 *
 * The retry policy is the load-bearing part, and it differs by intent:
 *
 *   reads    retried, because re-reading a round changes nothing.
 *   writes   never retried automatically. A retried `POST` that actually succeeded is a second
 *            cedi claimed against a member who already paid. Safety comes from the
 *            idempotency key the caller supplies, not from a blind retry.
 *
 * Rule IDs: 1791027903-money-handling-and-safeguards.md C-S5, C-S9, M1, Z1
 */

import { QueryClient } from "@tanstack/react-query";

import { ApiError, apiFetch } from "./api";

/** A round moves when money moves, so it is never considered fresh for long. */
export const ROUND_STALE_MS = 5000;

/**
 * Key factories.
 *
 * Every key is a function so a query cannot be cached under a hand-written string that
 * drifts from the one used to invalidate it. A key that only half matches leaves a screen
 * showing the previous round's total.
 */
export const queryKeys = {
  groups: () => ["groups"],
  memberSummary: () => ["member", "summary"],
  currentRound: (groupId) => ["round", "current", groupId],
  round: (roundId) => ["round", roundId],
  auditFeed: (groupId) => ["audit", groupId],
  contributions: (roundId) => ["contributions", roundId],
};

/** Every round, whatever the shape of its key. Used to invalidate after money moves. */
const ANY_ROUND = ["round"];

/**
 * Forget everything the server told us about the member who just left.
 *
 * The keys here are `["groups"]`, `["round", id]`, `["audit", groupId]` — none of them name the
 * account they belong to. That is fine while one person uses a phone and wrong the moment a
 * second one does: on sign-in the cache still holds the previous member's groups under the same
 * key, so the app renders their finances to someone who has no business seeing them. The
 * network is correctly scoped by the token; the cache was not.
 *
 * Scoping every key by account would also fix it, but every key would then have to be built
 * with an id that does not exist before sign-in, and a key built wrong fails open — two members
 * silently sharing a cache entry again. Clearing on every session change cannot fail that way:
 * no session change means the same person, and any change means nothing survives.
 *
 * Called on sign-in, on sign-out, and whenever the server rejects the token.
 */
export function forgetPreviousMember(queryClient) {
  queryClient.clear();
}

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: ROUND_STALE_MS,
        retry: (failureCount, error) => {
          // A refusal is the server's considered answer. Retrying it hides the message behind
          // a spinner and spends the member's battery doing it.
          if (error instanceof ApiError && error.offline) return failureCount < 2;
          return false;
        },
        refetchOnWindowFocus: true,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

// --------------------------------------------------------------------------
// Session
//
// The token itself, and the sign-in call, live in `services/auth.js`. They are re-exported
// here because every caller that holds a QueryClient also needs a session, and one import for
// "the server-state layer" reads better than two. The dependency runs the other way: auth
// never imports this file, so the session store can sign a member in without pulling React's
// data layer in with it.
// --------------------------------------------------------------------------

export { getAccessToken, installApi, setAccessToken, signIn } from "./auth";

// --------------------------------------------------------------------------
// Reads
// --------------------------------------------------------------------------

export const queries = {
  groups: () => ({
    queryKey: queryKeys.groups(),
    queryFn: () => apiFetch("/api/groups/"),
  }),

  /**
   * The home tab's whole position in one read: the groups, what has
   * been paid in and out, what is owed, and which rounds are waiting.
   *
   * One endpoint rather than a list plus six counts, because a screen
   * that fetches them separately can show a hero total from a stale
   * response beside a due card from a fresh one. The numbers themselves
   * are the server's arithmetic, never the client's (C-S1).
   */
  memberSummary: () => ({
    queryKey: queryKeys.memberSummary(),
    queryFn: () => apiFetch("/api/members/me/summary/"),
  }),

  currentRound: (groupId) => ({
    queryKey: queryKeys.currentRound(groupId),
    queryFn: () => apiFetch(`/api/groups/${groupId}/rounds/current/`),
    staleTime: ROUND_STALE_MS,
  }),

  round: (roundId) => ({
    queryKey: queryKeys.round(roundId),
    queryFn: () => apiFetch(`/api/rounds/${roundId}/`),
  }),

  auditFeed: (groupId) => ({
    queryKey: queryKeys.auditFeed(groupId),
    queryFn: () => apiFetch(`/api/groups/${groupId}/audit/`),
  }),
};

// --------------------------------------------------------------------------
// Writes
// --------------------------------------------------------------------------

/**
 * Every write that moves money returns the authoritative round alongside its own result. So
 * on success the cached round is replaced with what the server just said, rather than
 * refetched: an extra request would only add a chance to render a stale number in between.
 */
function settleRound(queryClient, payload) {
  if (payload?.round?.id != null) {
    queryClient.setQueryData(queryKeys.round(payload.round.id), payload.round);
  }
  queryClient.invalidateQueries({ queryKey: ANY_ROUND });
  queryClient.invalidateQueries({ queryKey: ["contributions"] });
  queryClient.invalidateQueries({ queryKey: ["audit"] });
  // Money moved: what the member has paid in, what is waiting on them
  // and what needs their attention all changed with it.
  queryClient.invalidateQueries({ queryKey: queryKeys.memberSummary() });
}

export const mutations = {
  /**
   * Start a group.
   *
   * The roster is deliberately not part of this request. A membership points at a real account,
   * not at a name typed into a form, so the only person this can add to the rotation is the
   * caller — everyone else arrives later by redeeming the invite code in the response. A create
   * form that collected names would be asking the server to seat people who never agreed to it.
   */
  createGroup: (queryClient) => ({
    mutationKey: ["group", "create"],
    mutationFn: ({ name, targetPesewas, collectionDay, description }) =>
      apiFetch("/api/groups/", {
        method: "POST",
        body: { name, targetPesewas, collectionDay, description },
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.groups() }),
  }),

  /** Redeem an invite code. Adds the caller and nobody else. */
  joinGroup: (queryClient) => ({
    mutationKey: ["group", "join"],
    mutationFn: ({ inviteCode }) =>
      apiFetch("/api/groups/join/", { method: "POST", body: { inviteCode } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.groups() }),
  }),

  logContribution: (queryClient) => ({
    mutationKey: ["contribution", "record"],
    mutationFn: ({ roundId, amountPesewas, reference, idempotencyKey }) =>
      apiFetch(`/api/rounds/${roundId}/contributions/`, {
        method: "POST",
        body: { amountPesewas, reference, idempotencyKey },
        idempotencyKey,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["contributions"] }),
  }),

  verifyContribution: (queryClient) => ({
    mutationKey: ["contribution", "verify"],
    mutationFn: ({ contributionId }) =>
      apiFetch(`/api/contributions/${contributionId}/verify/`, { method: "POST", body: {} }),
    onSuccess: (payload) => settleRound(queryClient, payload),
  }),

  reverseContribution: (queryClient) => ({
    mutationKey: ["contribution", "reverse"],
    mutationFn: ({ contributionId, reason }) =>
      apiFetch(`/api/contributions/${contributionId}/reverse/`, {
        method: "POST",
        body: { reason },
      }),
    onSuccess: (payload) => settleRound(queryClient, payload),
  }),

  /**
   * Cancel an attempt that was started and never sent.
   *
   * The member's slot is held while a payment might still become money, so without this the
   * only way out of a mistaken amount is to pay and then have the payment reversed. No
   * `failed` counterpart exists on purpose: only the provider can say money never arrived.
   */
  voidContribution: (queryClient) => ({
    mutationKey: ["contribution", "void"],
    mutationFn: ({ contributionId, reason }) =>
      apiFetch(`/api/contributions/${contributionId}/void/`, {
        method: "POST",
        body: { reason },
      }),
    onSuccess: (payload) => settleRound(queryClient, payload),
  }),
};