/**
 * @jest-environment node
 */
const { makeMember, activeMembers, currentReceiver, roundCollected, isPayoutReady, memberShare } = require("../services/susu");
const { useSusuStore } = require("../store/susu");

const member = (id, order, extra = {}) =>
  makeMember({ id, name: id.toUpperCase(), order, phone: `+233 244 000 00${order}`, ...extra });

const seedGroup = (overrides = {}) => ({
  id: "gt",
  name: "Store Susu",
  targetAmount: 300,
  totalRounds: 3,
  currentRound: 1,
  currentTurnIndex: 0,
  cycle: 1,
  collectionDay: 5,
  cycleStartedAt: Date.now(),
  currentRoundDueAt: Date.now() + 86400000,
  isActive: true,
  createdAt: Date.now(),
  createdBy: "m1",
  adminTrustScore: 100,
  flaggedTotal: 0,
  members: [member("m1", 0, { role: "admin" }), member("m2", 1), member("m3", 2)],
  contributions: [],
  payouts: [],
  ...overrides,
});

const fundRound = (group, roundNumber = 1) => {
  let next = group;
  for (const m of activeMembers(group)) {
    next = {
      ...next,
      contributions: [
        ...next.contributions,
        { id: `c-${m.id}-${roundNumber}`, memberId: m.id, amount: 100, roundNumber, status: "verified", provider: "mtn_momo", reference: "MP1.0001" },
      ],
    };
  }
  return next;
};

const withGroup = (group, userId = "m1") =>
  useSusuStore.setState({ groups: [group], userId });

const getGroup = () => useSusuStore.getState().groups[0];

beforeEach(() => {
  useSusuStore.setState({ groups: [] });
});

describe("createGroup", () => {
  it("puts the creator first as admin", () => {
    const id = useSusuStore.getState().createGroup({
      name: "New Susu",
      targetAmount: "200",
      collectionDay: 1,
      members: [{ name: "Kofi", phone: "0244" }],
    });
    const group = useSusuStore.getState().groups.find((g) => g.id === id);
    expect(group.members[0].role).toBe("admin");
    expect(group.members[0].order).toBe(0);
    expect(group.members[1].name).toBe("Kofi");
    expect(group.currentRound).toBe(1);
    expect(group.isActive).toBe(true);
  });

  it("sets a due date for the first round", () => {
    const id = useSusuStore.getState().createGroup({
      name: "S",
      targetAmount: "200",
      collectionDay: 1,
      members: [{ name: "K", phone: "1" }],
    });
    const group = useSusuStore.getState().groups.find((g) => g.id === id);
    expect(group.currentRoundDueAt).toBeGreaterThan(Date.now());
  });
});

describe("contribution lifecycle", () => {
  it("logs a contribution as pending", () => {
    withGroup(seedGroup());
    useSusuStore.getState().logContribution("gt", { amount: "100", provider: "mtn_momo", reference: "MP2601.0001" });
    const [c] = getGroup().contributions;
    expect(c.status).toBe("pending");
    expect(c.memberId).toBe("m1");
    expect(c.amount).toBe(100);
  });

  it("verifies a pending contribution", () => {
    withGroup(seedGroup());
    useSusuStore.getState().logContribution("gt", { amount: "100", provider: "mtn_momo", reference: "MP2601.0001" });
    const { id } = getGroup().contributions[0];
    useSusuStore.getState().verifyContribution("gt", id);
    expect(getGroup().contributions[0].status).toBe("verified");
  });

  it("marks a contribution failed with a reason", () => {
    const group = seedGroup({
      contributions: [{ id: "c1", memberId: "m2", amount: 100, roundNumber: 1, status: "pending", provider: "mtn_momo", reference: "MP1" }],
    });
    withGroup(group);
    useSusuStore.getState().failContribution("gt", "c1", "Reference not found");
    expect(getGroup().contributions[0].status).toBe("failed");
    expect(getGroup().contributions[0].failedReason).toBe("Reference not found");
  });

  it("a failed contribution does not count toward the pot", () => {
    const group = seedGroup({
      contributions: [
        { id: "c1", memberId: "m2", amount: 200, roundNumber: 1, status: "failed", provider: "mtn_momo", reference: "MP1" },
        { id: "c2", memberId: "m3", amount: 200, roundNumber: 1, status: "verified", provider: "mtn_momo", reference: "MP2" },
      ],
    });
    withGroup(group);
    expect(roundCollected(getGroup(), 1)).toBe(200);
    expect(isPayoutReady(getGroup())).toBe(false);
  });
});

describe("admin liability", () => {
  const flagged = () =>
    seedGroup({
      contributions: [{ id: "c1", memberId: "m2", amount: 100, roundNumber: 1, status: "pending", provider: "mtn_momo", reference: "MP1" }],
    });

  it("costs 25 trust points and flags the contribution", () => {
    withGroup(flagged());
    const result = useSusuStore.getState().flagContribution("gt", "c1");
    expect(getGroup().contributions[0].status).toBe("flagged");
    expect(getGroup().adminTrustScore).toBe(75);
    expect(result.adminRevoked).toBe(false);
  });

  it("revokes admin privileges after two flags", () => {
    withGroup(flagged());
    useSusuStore.getState().flagContribution("gt", "c1");
    const result = useSusuStore.getState().flagContribution("gt", "c1");
    expect(getGroup().adminTrustScore).toBe(50);
    expect(result.adminRevoked).toBe(true);
    expect(getGroup().members.find((m) => m.id === "m1").role).toBe("member");
  });

  it("hands admin over to the next active member instead of leaving the group adminless", () => {
    withGroup(flagged());
    useSusuStore.getState().flagContribution("gt", "c1");
    const result = useSusuStore.getState().flagContribution("gt", "c1");
    const admins = getGroup().members.filter((m) => m.role === "admin");
    expect(admins).toHaveLength(1);
    expect(admins[0].id).toBe(result.newAdminId);
    expect(result.newAdminId).toBe("m2");
    expect(getGroup().createdBy).toBe("m2");
  });

  it("never drops the trust score below zero", () => {
    withGroup(flagged());
    for (let i = 0; i < 5; i += 1) useSusuStore.getState().flagContribution("gt", "c1");
    expect(getGroup().adminTrustScore).toBe(0);
  });
});

describe("payout lifecycle", () => {
  it("refuses to release when the pot is not full", () => {
    withGroup(seedGroup());
    expect(useSusuStore.getState().releasePayout("gt")).toBeNull();
  });

  it("moves a ready pot to processing without advancing the round", () => {
    withGroup(fundRound(seedGroup()));
    const result = useSusuStore.getState().releasePayout("gt");
    expect(result.receiver.id).toBe("m1");
    expect(getGroup().payouts[0].status).toBe("processing");
    expect(getGroup().currentRound).toBe(1);
  });

  it("advances the round and moves the turn only on confirmation", () => {
    withGroup(fundRound(seedGroup()));
    const { payout } = useSusuStore.getState().releasePayout("gt");
    const result = useSusuStore.getState().confirmPayout("gt", payout.id);
    expect(getGroup().payouts[0].status).toBe("completed");
    expect(getGroup().currentRound).toBe(2);
    expect(currentReceiver(getGroup()).id).toBe("m2");
    expect(result.finished).toBe(false);
  });

  it("marks a transfer failed and allows a retry", () => {
    withGroup(fundRound(seedGroup()));
    const { payout } = useSusuStore.getState().releasePayout("gt");
    useSusuStore.getState().failPayout("gt", payout.id, "Rejected by provider");
    expect(getGroup().payouts[0].status).toBe("failed");
    expect(getGroup().currentRound).toBe(1);

    const retry = useSusuStore.getState().releasePayout("gt");
    expect(retry).not.toBeNull();
    expect(getGroup().payouts).toHaveLength(2);
    expect(getGroup().payouts[1].status).toBe("processing");
  });

  it("completes the cycle after the final round", () => {
    let group = seedGroup({ totalRounds: 1 });
    group = fundRound(group);
    withGroup(group);
    const { payout } = useSusuStore.getState().releasePayout("gt");
    const result = useSusuStore.getState().confirmPayout("gt", payout.id);
    expect(result.finished).toBe(true);
    expect(getGroup().isActive).toBe(false);
  });
});

describe("miss policy", () => {
  it("charges a missed share and gives one free skip", () => {
    withGroup(seedGroup());
    useSusuStore.getState().logContribution("gt", { amount: "100", provider: "mtn_momo", reference: "MP2601.0001" });
    useSusuStore.getState().closeRound("gt");
    const nonContributor = getGroup().members.find((m) => m.id === "m2");
    const contributor = getGroup().members.find((m) => m.id === "m1");
    expect(nonContributor.missedStreak).toBe(1);
    expect(nonContributor.missedShare).toBeCloseTo(memberShare(seedGroup()), 2);
    expect(nonContributor.active).toBe(true);
    expect(contributor.missedStreak).toBe(0);
  });

  it("removes a member after two misses", () => {
    withGroup(seedGroup());
    useSusuStore.getState().closeRound("gt");
    useSusuStore.getState().closeRound("gt");
    const repeated = getGroup().members.find((m) => m.id === "m1");
    expect(repeated.missedStreak).toBe(2);
    expect(repeated.active).toBe(false);
    expect(activeMembers(getGroup()).map((m) => m.id)).not.toContain("m1");
  });

  it("accumulates the missed share across misses", () => {
    withGroup(seedGroup());
    useSusuStore.getState().closeRound("gt");
    useSusuStore.getState().closeRound("gt");
    expect(getGroup().members.find((m) => m.id === "m1").missedShare).toBe(200);
  });

  it("does not advance the turn when the receiver missed", () => {
    withGroup(seedGroup());
    useSusuStore.getState().closeRound("gt");
    expect(currentReceiver(getGroup()).id).toBe("m1");
  });

  it("advances the turn when the receiver did contribute", () => {
    const group = seedGroup({
      contributions: [{ id: "c1", memberId: "m1", amount: 100, roundNumber: 1, status: "verified", provider: "mtn_momo", reference: "MP1" }],
    });
    withGroup(group);
    useSusuStore.getState().closeRound("gt");
    expect(currentReceiver(getGroup()).id).toBe("m2");
  });

  it("clears missed shares on restart", () => {
    withGroup(seedGroup());
    useSusuStore.getState().closeRound("gt");
    useSusuStore.getState().restartCycle("gt");
    expect(getGroup().currentRound).toBe(1);
    expect(getGroup().cycle).toBe(2);
    expect(getGroup().members.every((m) => m.missedShare === 0 && m.missedStreak === 0)).toBe(true);
  });
});

describe("invite codes and joining", () => {
  // The joiner is not yet a member of the group they are joining.
  const JOINER = "u9";

  it("gives a new group a usable invite code", () => {
    const id = useSusuStore.getState().createGroup({
      name: "New Susu",
      targetAmount: "200",
      collectionDay: 1,
      members: [{ name: "Kofi", phone: "0244" }],
    });
    const group = useSusuStore.getState().groups.find((g) => g.id === id);
    expect(group.inviteCode).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
  });

  it("does not reuse an existing code", () => {
    withGroup(seedGroup({ inviteCode: "AAAAAA" }));
    const id = useSusuStore.getState().createGroup({
      name: "S",
      targetAmount: "200",
      collectionDay: 1,
      members: [{ name: "K", phone: "9" }],
    });
    const created = useSusuStore.getState().groups.find((g) => g.id === id);
    expect(created.inviteCode).not.toBe("AAAAAA");
  });

  it("joins a group with a valid code and appends to the rotation", () => {
    withGroup(seedGroup({ inviteCode: "MK7QW2" }), JOINER);
    const result = useSusuStore.getState().joinGroup("mk7-qw2", { name: "Newcomer", phone: "0244000" });
    expect(result.ok).toBe(true);
    expect(result.groupId).toBe("gt");
    const joined = getGroup().members.find((m) => m.name === "Newcomer");
    expect(joined.order).toBe(3);
    expect(joined.role).toBe("member");
    expect(getGroup().totalRounds).toBe(4);
  });

  it("rejects an unknown code", () => {
    withGroup(seedGroup({ inviteCode: "MK7QW2" }), JOINER);
    const result = useSusuStore.getState().joinGroup("ZZZ999", {});
    expect(result.ok).toBe(false);
    expect(getGroup().members).toHaveLength(3);
  });

  it("rejects joining the same group twice", () => {
    withGroup(seedGroup({ inviteCode: "MK7QW2" }), JOINER);
    useSusuStore.getState().joinGroup("MK7QW2", {});
    const result = useSusuStore.getState().joinGroup("MK7QW2", {});
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/already in/i);
    expect(getGroup().members).toHaveLength(4);
  });

  it("rejects joining an ended group", () => {
    withGroup(seedGroup({ inviteCode: "MK7QW2", isActive: false }), JOINER);
    const result = useSusuStore.getState().joinGroup("MK7QW2", {});
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/ended/i);
  });

  it("rejects a phone number already in the group", () => {
    withGroup(seedGroup({ inviteCode: "MK7QW2" }), JOINER);
    const existing = getGroup().members[0].phone;
    const result = useSusuStore.getState().joinGroup("MK7QW2", { name: "X", phone: existing });
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/already in this group/i);
    expect(getGroup().members).toHaveLength(3);
  });

  it("regenerating a code invalidates the old one", () => {
    withGroup(seedGroup({ inviteCode: "MK7QW2" }), JOINER);
    useSusuStore.getState().regenerateInviteCode("gt");
    expect(getGroup().inviteCode).not.toBe("MK7QW2");
    expect(useSusuStore.getState().joinGroup("MK7QW2", {}).ok).toBe(false);
  });
});

describe("membership", () => {
  it("appends a new member to the end of the rotation", () => {
    withGroup(seedGroup());
    useSusuStore.getState().addMember("gt", { name: "New", phone: "0244" });
    const added = getGroup().members.find((m) => m.name === "New");
    expect(added.order).toBe(3);
  });

  it("rejects a duplicate phone number", () => {
    withGroup(seedGroup());
    const existingPhone = getGroup().members[0].phone;
    useSusuStore.getState().addMember("gt", { name: "Clone", phone: existingPhone });
    expect(getGroup().members).toHaveLength(3);
  });

  it("removes a member and reindexes the rotation", () => {
    withGroup(seedGroup());
    useSusuStore.getState().removeMember("gt", "m2");
    expect(getGroup().members.map((m) => m.order)).toEqual([0, 1]);
  });
});
