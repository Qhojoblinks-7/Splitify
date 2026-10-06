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
const { formatGHC } = require("../services/money");
const { toRoundView } = require("../services/roundView");
const {
  createQueryClient,
  forgetPreviousMember,
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
const OUTSIDER_PHONE = process.env.GROWL_API_OUTSIDER_PHONE;
const GROUP_ID = Number(process.env.GROWL_API_GROUP_ID);
const ROUND_ID = Number(process.env.GROWL_API_ROUND_ID);
const SHARE_PESEWAS = Number(process.env.GROWL_API_SHARE_PESEWAS);
const PHONE = process.env.GROWL_API_PHONE;
const PASSWORD = process.env.GROWL_API_PASSWORD;
const PAYER_TOKEN = process.env.GROWL_API_PAYER_TOKEN;

const describeLive = BASE_URL && TOKEN ? describe : describe.skip;

// Every assertion in this file is a real round trip through Django and SQLite, not a mock.
// Jest's 5s default is not a meaningful bound for that: running the whole backend suite in
// parallel loads the machine enough to push a four-request test to 5s, which fails on timing
// rather than on behaviour and then strands the next test behind a frozen slot. 15s leaves
// generous headroom for a loaded CI box while still bounding a genuine hang well inside the
// harness's own 300s ceiling.
jest.setTimeout(15000);

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
  // Undo what the test did. No GET /api/contributions/<id>/ exists to read the state
  // from, and guessing wrong is worse than letting the server refuse: whichever
  // transition the server rejects, the other one covers the other starting state.
  //
  // The two transitions have different authorities, so cleanup has to wear both
  // identities. Voiding is the member's own and only the member's own, so a pending
  // attempt is voided as the payer. Reversing is admin-only and never the admin's own
  // contribution, so a verified attempt is reversed as the admin. Doing this with one
  // token either way leaves the slot held, and the freeze rule then refuses every
  // later payment with "you already have a payment recorded for this round".
  for (const contributionId of opened) {
    asAdmin();
    const reversed = await apiFetch(`/api/contributions/${contributionId}/reverse/`, {
      method: "POST",
      body: { reason: "test cleanup" },
    }).then(() => true, () => false);
    if (reversed) continue;
    asPayer();
    await apiFetch(`/api/contributions/${contributionId}/void/`, {
      method: "POST",
      body: { reason: "test cleanup" },
    }).catch(() => {});
  }
  asAdmin();
  await queryClient.clear();
});

/** Run a real query through the real cache, exactly as a hook would. */
const runQuery = (options) => queryClient.fetchQuery(options);

/**
 * Read the round straight from the server, ignoring the cache.
 *
 * A write invalidates the round, and an *observed* query — which is what every screen is — refetches
 * itself the moment that invalidation lands. `fetchQuery` here has no observer, so it applies the
 * query's own `staleTime` and can hand back the value from before the write. That is fine for the
 * assertions about what a write does *not* change, and wrong for the ones about what it does, so
 * the post-write reads here pin `staleTime: 0` and ask the server outright.
 */
const readRoundNow = (groupId) =>
  queryClient.fetchQuery({ ...queries.currentRound(groupId), staleTime: 0 });

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

/**
 * Act as the member who pays, rather than the admin who confirms.
 *
 * An admin may not verify their own contribution, so a suite that has one account pay *and*
 * confirm is describing a transition the API refuses. Every payment below is therefore made by a
 * different member from the one that confirms it, which is also the shape of a real group: the
 * payer never marks their own money as received.
 *
 * The switch is explicit rather than automatic so a test that needs to assert "the payer cannot
 * verify this" can say so without reordering anything.
 */
const asPayer = () => setAccessToken(PAYER_TOKEN ?? TOKEN);
const asAdmin = () => setAccessToken(TOKEN);

let paymentCounter = 0;

/**
 * Log a payment as the paying member, and hand back to the admin.
 *
 * The token is switched before the write and restored immediately after, so the confirmation
 * calls that follow still run as the admin. Doing it in one place means a test cannot forget,
 * and a payment is never attributed to the wrong person by accident.
 */
async function recordPayment(reference, idempotencyKey) {
  paymentCounter += 1;
  asPayer();
  try {
    const created = await runMutation(
      mutations.logContribution(queryClient),
      {
        roundId: ROUND_ID,
        amountPesewas: SHARE_PESEWAS,
        reference: reference ?? `INT-${process.pid}-${paymentCounter}`,
        idempotencyKey,
      }
    );
    opened.push(created.id);
    return created;
  } finally {
    asAdmin();
  }
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

    // As the payer, who is the only account allowed to cancel their own attempt.
    asPayer();
    const payload = await runMutation(mutations.voidContribution(queryClient), {
      contributionId: created.id,
      reason: "Wrong amount entered",
    });
    asAdmin();

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

describeLive("the round screen's view model survives the real server", () => {
  // The screen draws `toRoundView(payload)` and nothing else, so this is the layer where a
  // renamed serializer field or a float where integer pesewas were agreed becomes a visible
  // `undefined` on a member's phone. Fixture-based tests cannot catch it: they assert against a
  // payload this project wrote, not the one Django produced.

  test("projects a real round without a single unreadable field", async () => {
    const round = await runQuery(queries.currentRound(GROUP_ID));
    const view = toRoundView(round);

    // Every displayed string is either a formatted amount or an em dash for "not applicable".
    // An em dash here would mean the projection could not read something the server sent.
    const amounts = [
      view.target,
      view.verified,
      view.shortfall,
      view.float,
      view.fee,
      view.ledger.debits,
      view.ledger.credits,
      view.ledger.residual,
      view.ledger.partnerBalance,
      view.ledger.groupPot,
      view.ledger.debtReceivable,
      view.ledger.feePayable,
    ];

    for (const amount of amounts) {
      expect(amount).not.toBe("—");
      expect(amount).toMatch(/^-?\d{1,3}(,\d{3})*\.\d{2}$/);
    }

    for (const entry of view.roster) {
      expect(entry.share).toMatch(/^\d{1,3}(,\d{3})*\.\d{2}$/);
      expect(entry.charged).toMatch(/^\d{1,3}(,\d{3})*\.\d{2}$/);
    }
  });

  test("formats the server's numbers without adjusting them", async () => {
    const round = await runQuery(queries.currentRound(GROUP_ID));
    const view = toRoundView(round);

    // Read, not recomputed. If the screen ever derives a total instead of reading it, this is
    // the assertion that notices, because it compares the display against the raw payload.
    expect(view.verified).toBe(formatGHC(round.verifiedTotalPesewas));
    expect(view.shortfall).toBe(formatGHC(round.shortfallPesewas));
    expect(view.target).toBe(formatGHC(round.targetPesewas));
    expect(view.ledger.residual).toBe(formatGHC(round.ledger.residualPesewas));
  });

  test("agrees with the server that the round balances", async () => {
    const round = await runQuery(queries.currentRound(GROUP_ID));
    const view = toRoundView(round);

    // Zero, always: the ledger balances and the money identity holds.
    expect(round.ledger.residualPesewas).toBe(0);
    expect(round.conservationResidual).toBe(0);

    // Not zero: debt is booked when a round closes, so an open round's debt residual is the
    // unbooked part of the shortfall. The invariant is that it never goes negative. Asserting
    // zero here would fail on every healthy round that has not finished collecting — which is
    // exactly the false alarm `balanced` used to raise.
    expect(round.debtResidual).toBeGreaterThanOrEqual(0);
    expect(view.balanced).toBe(true);
  });

  test("shows a member's debt as the server booked it", async () => {
    const round = await runQuery(queries.currentRound(GROUP_ID));
    const view = toRoundView(round);

    // `chargedPesewas` is omitted from the wire when nothing is owed, so the projection must
    // default rather than show an unreadable amount beside a member's name.
    for (const entry of round.roster) {
      expect(entry.chargedPesewas ?? 0).toBeGreaterThanOrEqual(0);
    }
    expect(view.roster.length).toBe(round.roster.length);
    expect(view.roster[0].isReceiver).toBe(round.roster[0].membershipId === round.receiverMembershipId);
  });
});

describeLive("one member's cached data must not reach the next", () => {
  // Regression guard for a real leak. `queryKeys.groups()` is `["groups"]` and every other key
  // is equally free of an account id, so two members sharing a phone would read each other's
  // finances straight out of the cache — the network is scoped by the token, the cache was not.
  test("a signed-out member's groups do not survive for whoever signs in next", async () => {
    setAccessToken(TOKEN);

    const mine = await runQuery(queries.groups());
    expect(mine.length).toBeGreaterThan(0);

    // What the app does on any session change. Without it the fetch below is a cache hit on the
    // same key and returns `mine` again, which is the bug.
    forgetPreviousMember(queryClient);

    if (!OUTSIDER_PHONE) return;
    await signIn({ phone: OUTSIDER_PHONE, password: PASSWORD });

    expect(await runQuery(queries.groups())).toEqual([]);

    setAccessToken(TOKEN);
  });

  test("clearing the cache does not disturb the round key factory", () => {
    // The keys are what make the cache wrong in the first place, so pin that they are stable
    // across a clear: a key that changed shape would defeat invalidation silently.
    expect(queryKeys.groups()).toEqual(["groups"]);
    expect(queryKeys.currentRound(7)).toEqual(["round", "current", 7]);

    forgetPreviousMember(queryClient);

    expect(queryKeys.groups()).toEqual(["groups"]);
    expect(queryKeys.currentRound(7)).toEqual(["round", "current", 7]);
  });
});

describeLive("the round screen's payment path", () => {
  test("a logged payment is visible as the member's own, and the pot has not moved", async () => {
    // The whole point of the contribute button, end to end. A logged payment is an *attempt*:
    // the member's row shows them as holding one, and the round total is unchanged, because
    // only a verified payment is money (C-S1).
    asPayer();
    const round = await runQuery(queries.currentRound(GROUP_ID));
    const mine = round.roster.find((entry) => entry.membershipId === round.myMembershipId);

    expect(round.canContribute).toBe(true);
    expect(round.openContributionId).toBeNull();
    expect(mine.paidPesewas).toBe(0);

    const logged = await runMutation(mutations.logContribution(queryClient), {
      roundId: round.id,
      amountPesewas: SHARE_PESEWAS,
      reference: "SCREEN-ATTEMPT-1",
    });
    opened.push(logged.id);

    const after = await readRoundNow(GROUP_ID);
    const afterMine = after.roster.find(
      (entry) => entry.membershipId === after.myMembershipId
    );

    expect(after.verifiedTotalPesewas).toBe(round.verifiedTotalPesewas);
    expect(after.canContribute).toBe(false);
    expect(after.openContributionId).toBe(logged.id);
    expect(afterMine.paidPesewas).toBe(0);
    expect(afterMine.openStatus).toBe("pending");

    // And the view model carries all of that to the screen without inventing any of it.
    const view = toRoundView(after);
    expect(view.canContribute).toBe(false);
    expect(view.openContributionId).toBe(logged.id);
    expect(view.roster.find((entry) => entry.isMe).paid).toBe("0.00");
  });

  test("withdrawing the attempt frees the member to pay again", async () => {
    asPayer();
    const round = await runQuery(queries.currentRound(GROUP_ID));
    const logged = await runMutation(mutations.logContribution(queryClient), {
      roundId: round.id,
      amountPesewas: SHARE_PESEWAS,
      reference: "SCREEN-WITHDRAW-1",
    });

    await runMutation(mutations.voidContribution(queryClient), {
      contributionId: logged.id,
      reason: "withdrawn",
    });

    const after = await readRoundNow(GROUP_ID);
    expect(after.canContribute).toBe(true);
    expect(after.openContributionId).toBeNull();
  });

  test("a second payment while one is open is refused, not silently accepted", async () => {
    asPayer();
    const round = await runQuery(queries.currentRound(GROUP_ID));
    const logged = await runMutation(mutations.logContribution(queryClient), {
      roundId: round.id,
      amountPesewas: SHARE_PESEWAS,
      reference: "SCREEN-FROZEN-1",
    });
    opened.push(logged.id);

    const second = await runMutation(mutations.logContribution(queryClient), {
      roundId: round.id,
      amountPesewas: SHARE_PESEWAS,
      reference: "SCREEN-FROZEN-2",
    }).catch((thrown) => thrown);

    expect(second).toBeInstanceOf(ApiError);
    // The screen is driven by `canContribute`, so this refusal is what the button prevents. It
    // still has to be refused server-side: the client is not the thing being trusted (C-S2).
    const after = await readRoundNow(GROUP_ID);
    expect(after.openContributionId).toBe(logged.id);
  });

  test("verified money reaches the pot and the member's own row together", async () => {
    asPayer();
    const round = await runQuery(queries.currentRound(GROUP_ID));
    const logged = await runMutation(mutations.logContribution(queryClient), {
      roundId: round.id,
      amountPesewas: SHARE_PESEWAS,
      reference: "SCREEN-VERIFY-1",
    });
    opened.push(logged.id);

    asAdmin();
    await verify(logged.id);

    // Read back as the payer, not the admin who did the verifying. The round total is the
    // same either way, but `myMembershipId` is not: the admin never paid, so asserting on the
    // admin's own row would check a row that has every right to still read zero. The claim
    // worth testing is that the member who paid sees their own share land.
    asPayer();
    const after = await readRoundNow(GROUP_ID);
    const mine = after.roster.find((entry) => entry.membershipId === after.myMembershipId);

    expect(after.verifiedTotalPesewas).toBe(SHARE_PESEWAS);
    expect(mine.paidPesewas).toBe(SHARE_PESEWAS);
    expect(mine.openStatus).toBe("verified");
    expect(toRoundView(after).balanced).toBe(true);
  });

  test("every member's paid amounts still add up to the round total", async () => {
    asPayer();
    const round = await runQuery(queries.currentRound(GROUP_ID));

    const sum = round.roster.reduce((total, entry) => total + entry.paidPesewas, 0);
    expect(sum).toBe(round.verifiedTotalPesewas);
  });
});

describeLive("starting and joining a group", () => {
  const NEWCOMER_PHONE = process.env.GROWL_API_NEWCOMER_PHONE;

// `signIn` installs the access token itself, so signing in as the newcomer is all it takes to
  // act as them for the rest of the test. A third account rather than the shared outsider,
  // because the isolation assertions below need someone who belongs to no group at all.
  const signInAsNewcomer = () => signIn({ phone: NEWCOMER_PHONE, password: PASSWORD });

  test("creating a group seats the caller and hands back an invite code", async () => {
    setAccessToken(TOKEN);

    const created = await runMutation(mutations.createGroup(queryClient), {
      name: "Live Created Susu",
      targetPesewas: 25000,
      collectionDay: 3,
    });

    expect(created.name).toBe("Live Created Susu");
    expect(created.targetPesewas).toBe(25000);
    expect(created.memberCount).toBe(1);
    expect(created.inviteCode).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);

    // The group is now the caller's, which is what makes it show up in the list the app reads.
    const mine = await runQuery(queries.groups());
    expect(mine.map((group) => group.id)).toContain(created.id);
  });

  test("a code seats the caller and nobody else", async () => {
    setAccessToken(TOKEN);
    const created = await runMutation(mutations.createGroup(queryClient), {
      name: "Live Joinable Susu",
      targetPesewas: 15000,
    });

    if (!NEWCOMER_PHONE) return;
    await signInAsNewcomer();

    const joined = await runMutation(mutations.joinGroup(queryClient), {
      inviteCode: created.inviteCode,
    });
    expect(joined.id).toBe(created.id);
    expect(joined.memberCount).toBe(2);

    // Joining again is refused rather than duplicating the membership.
    const again = await runMutation(mutations.joinGroup(queryClient), {
      inviteCode: created.inviteCode,
    }).catch((thrown) => thrown);
    expect(again).toBeInstanceOf(ApiError);
    expect(again.status).toBe(409);
  });

  test("an unknown code is refused and creates nothing", async () => {
    setAccessToken(TOKEN);

    const error = await runMutation(mutations.joinGroup(queryClient), {
      inviteCode: "ZZZZZZZZ",
    }).catch((thrown) => thrown);

    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(404);
  });

  test("a new group can be read straight into the round screen's view model", async () => {
    // The whole chain this milestone exists for: create on the server, read the round, and
    // render it without the device computing any of the money.
    setAccessToken(TOKEN);
    const created = await runMutation(mutations.createGroup(queryClient), {
      name: "Live Pilot Susu",
      targetPesewas: 20000,
    });

    const round = await runQuery(queries.currentRound(created.id));
    const view = toRoundView(round);

    expect(view.id).toBe(round.id);
    expect(view.target).toBe(formatGHC(round.targetPesewas));
    expect(view.verified).toBe(formatGHC(0));
    expect(view.balanced).toBe(true);
    expect(view.roster.length).toBe(1);
    expect(view.roster[0].isReceiver).toBe(true);
  });
});

describeLive("signing in against the real server", () => {
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
    await signIn({ phone: PHONE, password: PASSWORD });

    const own = await runQuery(queries.groups());
    const theirs = await runQuery(queries.groups());

    expect(own).toEqual(theirs);

    // The group the seed gave this member is in the list. Asserting the whole list by name
    // would only pass while the database happened to hold exactly one group, which says nothing
    // about the API — and other tests here create groups on purpose.
    expect(own.map((group) => group.id)).toContain(GROUP_ID);
    for (const group of own) {
      expect(Number.isInteger(group.targetPesewas)).toBe(true);
    }

    // And nobody else's, which is the part that matters. `forgetPreviousMember` is what the app
    // calls whenever the signed-in member changes; without it this fetch would be answered from
    // the cache under the very same `["groups"]` key and hand back the previous member's data.
    if (OUTSIDER_PHONE) {
      await signIn({ phone: OUTSIDER_PHONE, password: PASSWORD });
      forgetPreviousMember(queryClient);

      const outsiderGroups = await runQuery(queries.groups());

      expect(outsiderGroups).toEqual([]);
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