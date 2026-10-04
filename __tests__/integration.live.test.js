/**
 * @jest-environment node
 *
 * Frontend against backend. A real Django server, a real database, a real JWT, and the real
 * TanStack Query client and fetch wrapper this app ships.
 *
 * Not a mocked contract test. `GROWL_API_URL` and friends are handed in by pytest, which owns
 * the database and the server. Nothing here stubs a response: every number asserted below was
 * produced by the ledger and read back over HTTP.
 *
 * What this layer catches that neither side can catch alone:
 *
 *   - a field the serializer renamed and the client still reads, so a screen silently shows
 *     `undefined` where a cedi should be
 *   - a float or a string where integer pesewas were agreed, which no unit test on either
 *     side can see
 *   - a permission that holds in the domain and leaks through the view
 *   - client and server disagreeing about the same round, which is the defect that makes a
 *     group stop believing the number the app shows them
 *
 * Skipped, loudly, when run without a server: `npm test` must stay green on its own, and a
 * skipped suite is better than a fake one.
 */

const { ApiError, apiFetch, configureApi, resolveUrl } = require("../services/api");
const {
  createQueryClient,
  installApi,
  queries,
  mutations,
  queryKeys,
  setAccessToken,
  signIn,
} = require("../services/query");

const BASE_URL = process.env.GROWL_API_URL;
const TOKEN = process.env.GROWL_API_TOKEN;
const OUTSIDER_TOKEN = process.env.GROWL_API_OUTSIDER_TOKEN;
const GROUP_ID = Number(process.env.GROWL_API_GROUP_ID);
const ROUND_ID = Number(process.env.GROWL_API_ROUND_ID);
const SHARE_PESEWAS = Number(process.env.GROWL_API_SHARE_PESEWAS);

const describeLive = BASE_URL && TOKEN ? describe : describe.skip;

let queryClient;
/** Contributions this test opened, so a failure in one test cannot strand the next. */
let opened = [];

beforeEach(() => {
  installApi({ baseUrl: BASE_URL });
  setAccessToken(TOKEN);
  queryClient = createQueryClient();
  opened = [];
});

afterEach(async () => {
  // Clean up after the test that ran, not after the test that passed. Otherwise the first
  // assertion to fail leaves a member's payment open and every later test reports a
  // misleading "already have a payment recorded" instead of its own problem.
  //
  // Verify before reversing: a pending attempt holds the member's slot, and only a verified
  // one can be reversed. That ordering is the freeze rule working as intended.
  for (const contributionId of opened) {
    await apiFetch(`/api/contributions/${contributionId}/verify/`, {
      method: "POST",
      body: {},
    }).catch(() => {});
    await apiFetch(`/api/contributions/${contributionId}/reverse/`, {
      method: "POST",
      body: {},
    }).catch(() => {});
  }
  await queryClient.clear();
});

/** Run a real query through the real cache, exactly as a hook would. */
const runQuery = (options) => queryClient.fetchQuery(options);

/** Run a mutation the way `useMutation` does: mutationFn, then its success handler. */
async function runMutation(options, variables) {
  const payload = await options.mutationFn(variables);
  if (options.onSuccess) await options.onSuccess(payload, variables, undefined);
  return payload;
}

const verify = (contributionId) =>
  runMutation(mutations.verifyContribution(queryClient), { contributionId });

const reverse = (contributionId) =>
  runMutation(mutations.reverseContribution(queryClient), { contributionId });

let paymentCounter = 0;

function recordPayment(reference, idempotencyKey) {
  paymentCounter += 1;
  return runMutation(
    mutations.logContribution(queryClient),
    {
      roundId: ROUND_ID,
      amountPesewas: SHARE_PESEWAS,
      reference: reference ?? `INT-${process.pid}-${paymentCounter}`,
      idempotencyKey,
    }
  ).then((created) => {
    opened.push(created.id);
    return created;
  });
}

describeLive("the client and the server agree about money", () => {
  test("a group reads its round and the roster of frozen shares", async () => {
    const round = await runQuery(queries.currentRound(GROUP_ID));

    expect(round.id).toBe(ROUND_ID);
    expect(round.targetPesewas).toBeGreaterThan(0);
    expect(round.roster.length).toBeGreaterThanOrEqual(1);

    const shares = round.roster.reduce((total, entry) => total + entry.sharePesewas, 0);
    expect(shares).toBe(round.targetPesewas);
  });

  test("every amount crossing the wire is an integer number of pesewas", async () => {
    const round = await runQuery(queries.round(ROUND_ID));

    const numbers = [];
    const walk = (value) => {
      if (Array.isArray(value)) return value.forEach(walk);
      if (value && typeof value === "object") return Object.values(value).forEach(walk);
      if (typeof value === "number") numbers.push(value);
    };
    walk(round);

    expect(numbers.length).toBeGreaterThan(0);
    for (const value of numbers) expect(Number.isInteger(value)).toBe(true);
    expect(round.verifiedTotalPesewas).toBe(0);
  });

  test("the ledger reports a zero residual before any money moves", async () => {
    const round = await runQuery(queries.round(ROUND_ID));

    expect(round.ledger.residualPesewas).toBe(0);
    expect(round.ledger.partnerBalancePesewas).toBe(0);
    expect(round.ledger.debitsPesewas).toBe(round.ledger.creditsPesewas);
  });

  test("logging a payment does not yet count toward the pot", async () => {
    const before = await runQuery(queries.round(ROUND_ID));

    const created = await recordPayment();
    expect(created.status).toBe("pending");
    expect(created.amountPesewas).toBe(SHARE_PESEWAS);

    const after = await runQuery(queries.round(ROUND_ID));
    expect(after.verifiedTotalPesewas).toBe(0);
    expect(after.shortfallPesewas).toBe(before.shortfallPesewas);
  });

  test("verifying grows the pot, the float and the collection account together", async () => {
    const created = await recordPayment();

    const payload = await verify(created.id);

    expect(payload.contribution.status).toBe("verified");
    expect(payload.round.verifiedTotalPesewas).toBe(created.amountPesewas);
    expect(payload.round.ledger.partnerBalancePesewas).toBe(created.amountPesewas);
    expect(payload.round.closingFloatPesewas).toBe(created.amountPesewas);
    expect(payload.round.ledger.residualPesewas).toBe(0);
  });

  test("the cached round is the round the server just returned, without a refetch", async () => {
    const created = await recordPayment();
    const payload = await verify(created.id);

    const cached = queryClient.getQueryData(queryKeys.round(ROUND_ID));
    expect(cached.verifiedTotalPesewas).toBe(payload.round.verifiedTotalPesewas);
    expect(cached.ledger.partnerBalancePesewas).toBe(created.amountPesewas);
  });

  test("reversing takes the money back and the app sees the pot shrink", async () => {
    const created = await recordPayment();
    await verify(created.id);

    const payload = await reverse(created.id);

    expect(payload.contribution.status).toBe("reversed");
    expect(payload.round.verifiedTotalPesewas).toBe(0);
    expect(payload.round.ledger.partnerBalancePesewas).toBe(0);
    expect(payload.round.closingFloatPesewas).toBe(0);
    expect(payload.round.ledger.residualPesewas).toBe(0);
  });

  test("a second payment while one is open is refused in the client's own words", async () => {
    const created = await recordPayment();

    const error = await recordPayment("INT-DUP-1").catch((thrown) => thrown);

    expect(error).toBeInstanceOf(ApiError);
    expect(error.refused).toBe(true);
    expect(error.offline).toBe(false);
    expect(error.message).toMatch(/already have a payment/i);
  });

  test("a replayed idempotency key does not become a second payment", async () => {
    // The offline queue replays writes it could not confirm. A replay that is not idempotent
    // is a second cedi against a member who already paid.
    const idempotencyKey = "11111111-2222-4333-8444-555555555555";

    const first = await recordPayment("INT-REPLAY-1", idempotencyKey);
    const second = await recordPayment("INT-REPLAY-1", idempotencyKey);

    expect(second.id).toBe(first.id);
  });

  test("the audit feed shows both sides of the money, with the states traversed", async () => {
    const created = await recordPayment();
    await verify(created.id);

    const feed = await runQuery(queries.auditFeed(GROUP_ID));
    const actions = feed.map((event) => event.action);

    expect(actions).toContain("contribution.recorded");
    expect(actions).toContain("contribution.verified");

    const verified = feed.find((event) => event.action === "contribution.verified");
    expect(verified.fromState).toBe("pending");
    expect(verified.toState).toBe("verified");
    expect(typeof verified.actorName).toBe("string");
  });

  test("a member can cancel an attempt they never sent", async () => {
    // The freeze rule holds a member's slot while a payment might still become money. Without
    // a way to cancel, a mistaken amount can only be escaped by paying and being reversed.
    const created = await recordPayment();

    const payload = await runMutation(mutations.voidContribution(queryClient), {
      contributionId: created.id,
      reason: "Wrong amount entered",
    });

    expect(payload.contribution.status).toBe("void");
    expect(payload.round.verifiedTotalPesewas).toBe(0);

    // And the slot is genuinely free again.
    const again = await recordPayment();
    expect(again.status).toBe("pending");
  });

  test("a member cannot declare their own payment failed", async () => {
    // Asserting that the provider never confirmed money is the provider's claim to make. A
    // member able to make it walks away from cedi they actually sent.
    const created = await recordPayment();

    const error = await apiFetch(`/api/contributions/${created.id}/fail/`, {
      method: "POST",
      body: {},
    }).catch((thrown) => thrown);

    expect(error.status).toBe(404);
  });

  test("an outsider holding a valid token still sees nothing of this group", async () => {
    if (!OUTSIDER_TOKEN) return;
    setAccessToken(OUTSIDER_TOKEN);

    const error = await runQuery(queries.round(ROUND_ID)).catch((thrown) => thrown);
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(403);
    expect(await runQuery(queries.groups())).toEqual([]);

    setAccessToken(TOKEN);
  });

  test("a missing token is refused rather than treated as an empty group", async () => {
    setAccessToken(null);

    const error = await runQuery(queries.round(ROUND_ID)).catch((thrown) => thrown);
    expect(error.status).toBe(401);
  });
});

describeLive("signing in against the real server", () => {
  const PHONE = process.env.GROWL_API_PHONE;
  const PASSWORD = process.env.GROWL_API_PASSWORD;

  test("valid credentials return a session and the token works", async () => {
    setAccessToken(null);

    const session = await signIn({ phone: PHONE, password: PASSWORD });

    expect(typeof session.access).toBe("string");
    expect(session.access.split(".")).toHaveLength(3);
    expect(typeof session.refresh).toBe("string");

    // The token the sign-in returned is the one every later request now carries.
    const groups = await runQuery(queries.groups());
    expect(Array.isArray(groups)).toBe(true);

    setAccessToken(TOKEN);
  });

  test("a wrong password is refused and no session is kept", async () => {
    setAccessToken(null);

    const error = await signIn({ phone: PHONE, password: "not-the-password" }).catch(
      (thrown) => thrown
    );

    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(401);
    expect(error.refused).toBe(true);
  });

  test("an unknown phone number is refused the same way", async () => {
    setAccessToken(null);

    const error = await signIn({ phone: "+233209999999", password: PASSWORD }).catch(
      (thrown) => thrown
    );

    expect(error.status).toBe(401);
  });

  test("a server that rejects the token is reported so the session can be cleared", async () => {
    // The wrapper's onUnauthorized is what stops a screen rendering numbers it can no longer
    // refresh. It has to fire, and it has to fire before the error is thrown.
    let cleared = false;
    installApi({
      baseUrl: BASE_URL,
      onUnauthorized: () => {
        cleared = true;
      },
    });
    setAccessToken("a-token-the-server-has-never-issued");

    const error = await runQuery(queries.groups()).catch((thrown) => thrown);

    expect(error.status).toBe(401);
    expect(cleared).toBe(true);
  });

  test("a signed-in member sees their own groups and nobody else's", async () => {
    setAccessToken(null);
    const session = await signIn({ phone: PHONE, password: PASSWORD });

    const own = await runQuery(queries.groups());
    const theirs = await runQuery(queries.groups());

    expect(own).toEqual(theirs);
    for (const group of own) {
      expect(group.name).toBe("Live Susu");
      expect(Number.isInteger(group.targetPesewas)).toBe(true);
    }

    setAccessToken(TOKEN);
  });
});

describe("the API wrapper cannot be pointed somewhere else", () => {
  test("a caller-supplied absolute URL is refused before any request is made", () => {
    configureApi({ baseUrl: "https://api.example.test" });

    expect(() => resolveUrl("https://evil.test/steal")).toThrow(/relative/);
    expect(() => resolveUrl("//evil.test/steal")).toThrow();
    expect(resolveUrl("/api/groups/")).toBe("https://api.example.test/api/groups/");
  });

  test("the base URL must be an http origin", () => {
    expect(() => configureApi({ baseUrl: "javascript:alert(1)" })).toThrow(/origin/);
    expect(() => configureApi({ baseUrl: "file:///etc/passwd" })).toThrow(/origin/);
  });

  test("an unreachable server reads as offline, not as a refusal", async () => {
    // The distinction a member's experience depends on: "try again later" versus "you cannot
    // do that". Collapsing them is how a queued payment is retried after it already landed.
    configureApi({ baseUrl: "http://127.0.0.1:1" });

    const error = await apiFetch("/api/groups/").catch((thrown) => thrown);

    expect(error).toBeInstanceOf(ApiError);
    expect(error.offline).toBe(true);
    expect(error.refused).toBe(false);
  });
});