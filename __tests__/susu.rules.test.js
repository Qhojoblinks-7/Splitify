/** @jest-environment node */
const {
  activeMembers,
  currentReceiver,
  memberShare,
  memberContribution,
  roundCollected,
  roundContributions,
  roundStatus,
  isPayoutReady,
  groupProgress,
  validateContribution,
  validateGroupDraft,
  nextRoundDueAt,
  dueSummary,
  generateInviteCode,
  normalizeInviteCode,
  validateInviteCodeFormat,
  INVITE_CODE_LENGTH,
  makeMember,
  initialsOf,
  MIN_CONTRIBUTION,
  MAX_MEMBERS,
} = require("../services/susu");

const makeGroup = (overrides = {}) => ({
  id: "g",
  name: "Test Susu",
  targetAmount: 300,
  totalRounds: 3,
  currentRound: 1,
  currentTurnIndex: 0,
  cycle: 1,
  collectionDay: 5,
  cycleStartedAt: new Date("2026-01-02T10:00:00Z").getTime(),
  currentRoundDueAt: null,
  isActive: true,
  adminTrustScore: 100,
  flaggedTotal: 0,
  members: [
    makeMember({ id: "m1", name: "Ada", order: 0, role: "admin" }),
    makeMember({ id: "m2", name: "Kofi", order: 1 }),
    makeMember({ id: "m3", name: "Ama", order: 2 }),
  ],
  contributions: [],
  payouts: [],
  ...overrides,
});

const contribute = (group, memberId, amount, status = "verified", roundNumber = group.currentRound) => ({
  ...group,
  contributions: [
    ...group.contributions,
    { id: `c-${memberId}-${roundNumber}`, memberId, amount, roundNumber, status, provider: "mtn_momo", reference: "MP2601.0001" },
  ],
});

describe("rotation", () => {
  it("returns active members in rotation order", () => {
    const group = makeGroup({
      members: [
        makeMember({ id: "m2", name: "Kofi", order: 1 }),
        makeMember({ id: "m1", name: "Ada", order: 0 }),
        makeMember({ id: "m3", name: "Ama", order: 2, active: false }),
      ],
    });
    expect(activeMembers(group).map((m) => m.id)).toEqual(["m1", "m2"]);
  });

  it("picks the receiver from the current turn index", () => {
    const group = makeGroup({ currentTurnIndex: 2 });
    expect(currentReceiver(group).id).toBe("m3");
  });

  it("wraps the turn index around the roster", () => {
    const group = makeGroup({ currentTurnIndex: 3 });
    expect(currentReceiver(group).id).toBe("m1");
  });

  it("returns null when everyone has been removed", () => {
    const group = makeGroup({
      members: [makeMember({ id: "m1", name: "Ada", order: 0, active: false })],
    });
    expect(currentReceiver(group)).toBeNull();
  });
});

describe("memberShare", () => {
  it("splits the pot evenly across the roster", () => {
    expect(memberShare(makeGroup({ targetAmount: 300 }))).toBe(100);
  });

  it("rounds to two decimals", () => {
    expect(memberShare(makeGroup({ targetAmount: 100 }))).toBe(33.33);
  });

  it("is zero for an empty roster", () => {
    expect(memberShare(makeGroup({ members: [] }))).toBe(0);
  });
});

describe("round status", () => {
  it("is collecting while the pot is under target", () => {
    const group = contribute(makeGroup(), "m1", 100);
    expect(roundStatus(group)).toBe("collecting");
  });

  it("is ready once verified contributions meet the pot", () => {
    let group = makeGroup();
    group = contribute(group, "m1", 150);
    group = contribute(group, "m2", 150);
    expect(roundStatus(group)).toBe("ready");
    expect(isPayoutReady(group)).toBe(true);
  });

  it("does not count pending or failed contributions", () => {
    let group = makeGroup();
    group = contribute(group, "m1", 300, "pending");
    group = contribute(group, "m2", 300, "failed");
    expect(roundCollected(group, 1)).toBe(0);
    expect(roundStatus(group)).toBe("collecting");
  });

  it("is short when everyone contributed and verified but the pot is still under target", () => {
    let group = makeGroup();
    group = contribute(group, "m1", 50);
    group = contribute(group, "m2", 50);
    group = contribute(group, "m3", 50);
    expect(roundStatus(group)).toBe("short");
    expect(isPayoutReady(group)).toBe(false);
  });

  it("is not payout ready for an ended group even when the pot is full", () => {
    let group = makeGroup({ isActive: false });
    group = contribute(group, "m1", 300);
    expect(roundStatus(group)).toBe("ready");
    expect(isPayoutReady(group)).toBe(false);
  });
});

describe("contribution lookups", () => {
  it("finds a member contribution for a round", () => {
    const group = contribute(makeGroup(), "m2", 100);
    expect(memberContribution(group, "m2", 1).amount).toBe(100);
  });

  it("returns null when the member has not contributed", () => {
    expect(memberContribution(makeGroup(), "m2", 1)).toBeNull();
  });

  it("does not match a contribution from a different round", () => {
    const group = contribute(makeGroup(), "m2", 100, "verified", 1);
    expect(memberContribution(group, "m2", 2)).toBeNull();
    expect(roundContributions(group, 2)).toHaveLength(0);
  });
});

describe("validateContribution", () => {
  const base = makeGroup();
  const valid = { amount: "100", provider: "mtn_momo", reference: "MP2601.0001" };

  it("accepts a valid contribution", () => {
    expect(validateContribution(base, valid, "m2").ok).toBe(true);
  });

  it(`rejects anything below the ${MIN_CONTRIBUTION} GHC minimum`, () => {
    expect(validateContribution(base, { ...valid, amount: "0.50" }, "m2").ok).toBe(false);
    expect(validateContribution(base, { ...valid, amount: "0" }, "m2").ok).toBe(false);
  });

  it("rejects a contribution larger than the pot", () => {
    expect(validateContribution(base, { ...valid, amount: "5000" }, "m2").ok).toBe(false);
  });

  it("rejects a missing provider", () => {
    expect(validateContribution(base, { ...valid, provider: null }, "m2").ok).toBe(false);
  });

  it("rejects a short reference", () => {
    expect(validateContribution(base, { ...valid, reference: "MP1" }, "m2").ok).toBe(false);
  });

  it("rejects a second contribution from the same member in one round", () => {
    const group = contribute(makeGroup(), "m2", 100);
    expect(validateContribution(group, valid, "m2").ok).toBe(false);
  });

  it("allows the same member to contribute in a later round", () => {
    const group = contribute(makeGroup(), "m2", 100, "verified", 1);
    const nextRound = { ...group, currentRound: 2 };
    expect(validateContribution(nextRound, valid, "m2").ok).toBe(true);
  });
});

describe("validateGroupDraft", () => {
  it("accepts a complete draft", () => {
    const draft = { name: "Susu", targetAmount: "200", members: [{ name: "Kofi", phone: "0244" }] };
    expect(validateGroupDraft(draft).ok).toBe(true);
  });

  it("requires a name", () => {
    expect(validateGroupDraft({ name: "  ", targetAmount: "200", members: [{ name: "K" }] }).ok).toBe(false);
  });

  it("requires a pot of at least 20", () => {
    expect(validateGroupDraft({ name: "S", targetAmount: "10", members: [{ name: "K" }] }).ok).toBe(false);
  });

  it("requires at least one other member", () => {
    expect(validateGroupDraft({ name: "S", targetAmount: "200", members: [] }).ok).toBe(false);
  });

  it("rejects duplicate phone numbers", () => {
    const draft = {
      name: "S",
      targetAmount: "200",
      members: [{ name: "A", phone: "0244" }, { name: "B", phone: "0244" }],
    };
    expect(validateGroupDraft(draft).ok).toBe(false);
  });

  it(`rejects more than ${MAX_MEMBERS} members`, () => {
    const members = Array.from({ length: MAX_MEMBERS }, (_, i) => ({ name: `M${i}`, phone: `02${i}` }));
    expect(validateGroupDraft({ name: "S", targetAmount: "200", members }).ok).toBe(false);
  });
});

describe("nextRoundDueAt", () => {
  it("returns the next Friday at the end of the day", () => {
    const due = new Date(nextRoundDueAt(5, new Date("2026-01-02T10:00:00Z").getTime(), 1));
    expect(due.getDay()).toBe(5);
    expect(due.getHours()).toBe(23);
  });

  it("advances by exactly one week per round", () => {
    const start = new Date("2026-01-02T10:00:00Z").getTime();
    const first = nextRoundDueAt(5, start, 1);
    const second = nextRoundDueAt(5, start, 2);
    expect(second - first).toBe(7 * 86400000);
  });
});

describe("groupProgress", () => {
  it("is zero on the first round", () => {
    expect(groupProgress(makeGroup({ currentRound: 1, totalRounds: 4 }))).toBe(0);
  });

  it("is capped at 1 past the final round", () => {
    expect(groupProgress(makeGroup({ currentRound: 9, totalRounds: 4 }))).toBe(1);
  });
});

describe("initialsOf", () => {
  it("takes the first two words", () => {
    expect(initialsOf("Ama Aboagye Mensah")).toBe("AA");
  });

  it("handles a single name", () => {
    expect(initialsOf("Kofi")).toBe("K");
  });
});

describe("invite codes", () => {
  it("generates a code of the right length", () => {
    expect(generateInviteCode()).toHaveLength(INVITE_CODE_LENGTH);
  });

  it("never uses ambiguous glyphs", () => {
    for (let i = 0; i < 200; i += 1) {
      expect(generateInviteCode()).not.toMatch(/[IO01]/);
    }
  });

  it("normalises case and strips separators", () => {
    expect(normalizeInviteCode("mk7-qw2")).toBe("MK7QW2");
    expect(normalizeInviteCode(" MK7 QW2 ")).toBe("MK7QW2");
  });

  it("validates length only", () => {
    expect(validateInviteCodeFormat("MK7QW2")).toBe(true);
    expect(validateInviteCodeFormat("MK7QW")).toBe(false);
    expect(validateInviteCodeFormat("")).toBe(false);
  });
});

describe("dueSummary", () => {
  const now = Date.now();

  it("lists active groups the user has not paid into", () => {
    const groups = [makeGroup({ id: "a", currentRoundDueAt: now + 86400000 })];
    expect(dueSummary(groups, "m1").map((d) => d.group.id)).toEqual(["a"]);
  });

  it("skips a group the user already contributed to", () => {
    const groups = [contribute(makeGroup({ id: "a" }), "m1", 100)];
    expect(dueSummary(groups, "m1")).toHaveLength(0);
  });

  it("skips groups the user is not a member of", () => {
    const groups = [makeGroup({ id: "a", currentRoundDueAt: now + 86400000 })];
    expect(dueSummary(groups, "somebody-else")).toHaveLength(0);
  });

  it("skips ended groups", () => {
    const groups = [makeGroup({ id: "a", isActive: false })];
    expect(dueSummary(groups, "m1")).toHaveLength(0);
  });

  it("sorts by due date, soonest first", () => {
    const groups = [
      makeGroup({ id: "late", currentRoundDueAt: now + 5 * 86400000 }),
      makeGroup({ id: "soon", currentRoundDueAt: now + 86400000 }),
    ];
    expect(dueSummary(groups, "m1").map((d) => d.group.id)).toEqual(["soon", "late"]);
  });

  it("flags overdue and soon due", () => {
    const groups = [
      makeGroup({ id: "late", currentRoundDueAt: now - 2 * 86400000 }),
      makeGroup({ id: "soon", currentRoundDueAt: now + 86400000 }),
      makeGroup({ id: "later", currentRoundDueAt: now + 9 * 86400000 }),
    ];
    const [overdue, soon, later] = dueSummary(groups, "m1", now);
    expect(overdue.overdue).toBe(true);
    expect(overdue.dueSoon).toBe(false);
    expect(soon.overdue).toBe(false);
    expect(soon.dueSoon).toBe(true);
    expect(later.dueSoon).toBe(false);
  });
});
