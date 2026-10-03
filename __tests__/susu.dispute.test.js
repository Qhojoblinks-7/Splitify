/**
 * @jest-environment node
 */
const { useSusuStore } = require("../store/susu");
const {
  canDispute,
  canAdminResolve,
  hasOpenDispute,
  openDisputes,
} = require("../services/dispute");
const { memberStatement, groupStatement, toCSV, toText, formatGHC } = require("../services/statement");

const member = (id, order, extra = {}) => ({
  id,
  name: id === "m1" ? "You" : id.toUpperCase(),
  phone: `+233 244 000 00${order}`,
  role: order === 0 ? "admin" : "member",
  order,
  active: true,
  missedStreak: 0,
  missedShare: 0,
  ...extra,
});

const seedGroup = (overrides = {}) => ({
  id: "g1",
  name: "Market Susu",
  description: "Traders association",
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
  inviteCode: "MK7QW2",
  members: [member("m1", 0), member("m2", 1), member("m3", 2)],
  contributions: [
    { id: "c1", roundNumber: 1, memberId: "m1", amount: 100, provider: "mtn_momo", reference: "MP1.0001", status: "verified", paidAt: Date.now() },
    { id: "c2", roundNumber: 1, memberId: "m2", amount: 100, provider: "mtn_momo", reference: "MP1.0002", status: "verified", paidAt: Date.now() },
    { id: "c3", roundNumber: 1, memberId: "m3", amount: 100, provider: "mtn_momo", reference: "MP1.0003", status: "verified", paidAt: Date.now() },
  ],
  payouts: [],
  ...overrides,
});

const withGroup = (group, userId = "m1") =>
  useSusuStore.setState({ groups: [group], userId });

const group = () => useSusuStore.getState().groups[0];
const contribution = (id = "c1") => group().contributions.find((c) => c.id === id);

beforeEach(() => {
  withGroup(seedGroup());
});

describe("opening a dispute", () => {
  it("lets the member who paid dispute their own contribution", () => {
    const guard = canDispute(group(), contribution("c1"), "m1");
    expect(guard.ok).toBe(true);

    const result = useSusuStore.getState().openDispute("g1", "c1", {
      reason: "not_paid",
      note: "That was my brother's line",
      openedBy: "m1",
    });

    expect(result).not.toBeNull();
    expect(contribution("c1").status).toBe("disputed");
  });

  it("lets the admin dispute an entry they recorded", () => {
    const guard = canDispute(group(), contribution("c2"), "m1");
    expect(guard.ok).toBe(true);
  });

  it("refuses a dispute from an unrelated member", () => {
    const guard = canDispute(group(), contribution("c1"), "m3");
    expect(guard.ok).toBe(false);
    expect(guard.message).toMatch(/only the member who paid/i);
  });

  it("refuses a dispute while the payment is still being verified", () => {
    useSusuStore.getState().logContribution("g1", {
      amount: "50",
      provider: "mtn_momo",
      reference: "MP1.9999",
    });
    const pending = group().contributions.find((c) => c.reference === "MP1.9999");
    const guard = canDispute(group(), pending, "m1");
    expect(guard.ok).toBe(false);
    expect(guard.message).toMatch(/still being verified/i);
  });

  it("records the reason, note and who opened it", () => {
    useSusuStore.getState().openDispute("g1", "c1", {
      reason: "wrong_amount",
      note: "It was 50 not 100",
      openedBy: "m1",
    });

    const dispute = contribution("c1").dispute;
    expect(dispute.reason).toBe("wrong_amount");
    expect(dispute.note).toBe("It was 50 not 100");
    expect(dispute.openedBy).toBe("m1");
    expect(dispute.resolution).toBeNull();
  });

  it("blocks the round even when the pot is already full", () => {
    expect(hasOpenDispute(group())).toBe(false);
    useSusuStore.getState().openDispute("g1", "c1", { reason: "not_paid", openedBy: "m1" });

    expect(hasOpenDispute(group())).toBe(true);
    expect(openDisputes(group())).toHaveLength(1);
    expect(useSusuStore.getState().releasePayout("g1")).toBeNull();
  });

  it("blocks the round without touching the pot total", () => {
    useSusuStore.getState().openDispute("g1", "c1", { reason: "not_paid", openedBy: "m1" });
    const verified = group().contributions
      .filter((c) => c.status === "verified")
      .reduce((sum, c) => sum + c.amount, 0);
    expect(verified).toBe(200);
  });
});

describe("resolving a dispute", () => {
  beforeEach(() => {
    useSusuStore.getState().flagContribution("g1", "c1");
    useSusuStore.getState().openDispute("g1", "c1", {
      reason: "not_paid",
      note: "I never sent that",
      openedBy: "m1",
    });
  });

  it("refuses to settle without admin rights", () => {
    const guard = canAdminResolve(group(), contribution("c1"), "m2");
    expect(guard.ok).toBe(false);
    expect(guard.message).toMatch(/only the group admin/i);
    expect(useSusuStore.getState().resolveDispute("g1", "c1", { resolution: "dismissed", resolvedBy: "m2" })).toBeNull();
  });

  it("restores the contribution and the trust score when dismissed", () => {
    const scoreAfterFlag = group().adminTrustScore;
    expect(scoreAfterFlag).toBeLessThan(100);

    const result = useSusuStore
      .getState()
      .resolveDispute("g1", "c1", { resolution: "dismissed", resolvedBy: "m1" });

    expect(result.restoredStatus).toBe("verified");
    expect(contribution("c1").status).toBe("verified");
    expect(group().adminTrustScore).toBeGreaterThan(scoreAfterFlag);
    expect(group().flaggedTotal).toBe(0);
  });

  it("unblocks the round once dismissed", () => {
    useSusuStore.getState().resolveDispute("g1", "c1", { resolution: "dismissed", resolvedBy: "m1" });
    expect(hasOpenDispute(group())).toBe(false);
  });

  it("voids the contribution and adds the debt when upheld", () => {
    const result = useSusuStore
      .getState()
      .resolveDispute("g1", "c1", { resolution: "upheld", resolvedBy: "m1" });

    expect(result.restoredStatus).toBe("failed");
    expect(result.owed).toBe(100);
    expect(contribution("c1").status).toBe("failed");

    const debtor = group().members.find((m) => m.id === "m1");
    expect(debtor.missedShare).toBe(100);
  });

  it("adds the upheld debt on top of an existing debt", () => {
    useSusuStore.setState({
      groups: [
        {
          ...group(),
          members: group().members.map((m) => (m.id === "m1" ? { ...m, missedShare: 40 } : m)),
        },
      ],
    });

    useSusuStore.getState().resolveDispute("g1", "c1", { resolution: "upheld", resolvedBy: "m1" });

    const debtor = group().members.find((m) => m.id === "m1");
    expect(debtor.missedShare).toBe(140);
  });

  it("keeps the round blocked when upheld", () => {
    useSusuStore.getState().resolveDispute("g1", "c1", { resolution: "upheld", resolvedBy: "m1" });
    expect(hasOpenDispute(group())).toBe(false);
    expect(useSusuStore.getState().releasePayout("g1")).toBeNull();
  });

  it("keeps the decision in the ledger permanently", () => {
    useSusuStore.getState().resolveDispute("g1", "c1", { resolution: "dismissed", resolvedBy: "m1" });

    const record = contribution("c1").dispute;
    expect(record.reason).toBe("not_paid");
    expect(record.note).toBe("I never sent that");
    expect(record.resolution).toBe("dismissed");
    expect(record.resolvedBy).toBe("m1");
    expect(record.resolvedAt).toBeTruthy();
  });
});

describe("statements", () => {
  it("totals what a member contributed and received", () => {
    const groupWithPayout = seedGroup({
      payouts: [
        { id: "p1", roundNumber: 1, memberId: "m1", amount: 300, status: "completed", reference: "PAY1.1", completedAt: Date.now() },
      ],
    });
    const statement = memberStatement(groupWithPayout, "m1");

    expect(statement.memberName).toBe("You");
    expect(statement.groupName).toBe("Market Susu");
    expect(statement.contributed).toBe(100);
    expect(statement.received).toBe(300);
  });

  it("reports what a member still owes", () => {
    const owing = seedGroup({
      members: [member("m1", 0, { missedShare: 75 }), member("m2", 1), member("m3", 2)],
    });
    expect(memberStatement(owing, "m1").outstanding).toBe(75);
  });

  it("counts only verified money in the group totals", () => {
    const messy = seedGroup({
      contributions: [
        { id: "c1", roundNumber: 1, memberId: "m1", amount: 100, provider: "mtn_momo", reference: "MP1.1", status: "verified", paidAt: Date.now() },
        { id: "c2", roundNumber: 1, memberId: "m2", amount: 100, provider: "mtn_momo", reference: "MP1.2", status: "failed", paidAt: Date.now() },
        { id: "c3", roundNumber: 1, memberId: "m3", amount: 100, provider: "mtn_momo", reference: "MP1.3", status: "disputed", paidAt: Date.now() },
      ],
    });
    expect(groupStatement(messy).verifiedTotal).toBe(100);
  });

  it("shows disputed and offline entries as such, not as verified", () => {
    const messy = seedGroup({
      contributions: [
        { id: "c1", roundNumber: 1, memberId: "m1", amount: 100, provider: "mtn_momo", reference: "MP1.1", status: "disputed", paidAt: Date.now() },
        { id: "c2", roundNumber: 1, memberId: "m2", amount: 100, provider: "mtn_momo", reference: "MP1.2", status: "pending", syncState: "offline", paidAt: Date.now() },
      ],
    });
    const words = groupStatement(messy).rows.map((r) => r.status);
    expect(words).toContain("Disputed");
    expect(words).toContain("Saved offline");
  });

  it("orders the group ledger by round", () => {
    const statement = groupStatement(
      seedGroup({
        contributions: [
          { id: "c2", roundNumber: 2, memberId: "m1", amount: 100, provider: "mtn_momo", reference: "MP1.2", status: "verified", paidAt: Date.now() },
          { id: "c1", roundNumber: 1, memberId: "m1", amount: 100, provider: "mtn_momo", reference: "MP1.1", status: "verified", paidAt: Date.now() },
        ],
      })
    );
    expect(statement.rows.map((r) => r.round)).toEqual([1, 2]);
  });

  it("writes CSV with a metadata header and a table", () => {
    const csv = toCSV(groupStatement(seedGroup()));
    expect(csv).toMatch(/GROUP LEDGER/);
    expect(csv).toMatch(/Market Susu/);
    expect(csv).toMatch(/Round,Date,Member,Type,Amount \(GHC\),Reference,Status/);
  });

  it("writes member CSV without a member column", () => {
    const csv = toCSV(memberStatement(seedGroup(), "m1"), { memberMode: true });
    expect(csv).toMatch(/MEMBER STATEMENT/);
    expect(csv).toMatch(/Round,Date,Type,Amount \(GHC\),Reference,Status/);
  });

  it("quotes cells containing commas so Excel keeps the columns", () => {
    const csv = toCSV(groupStatement(seedGroup({ name: "Market, Traders" })));
    expect(csv).toMatch(/"Market, Traders"/);
  });

  it("escapes quotes inside a cell", () => {
    const csv = toCSV(groupStatement(seedGroup({ name: 'The "Big" Susu' })));
    expect(csv).toMatch(/""Big""/);
  });

  it("writes a readable WhatsApp statement", () => {
    const text = toText(memberStatement(seedGroup(), "m1"), { memberMode: true });
    expect(text).toMatch(/You — Market Susu/);
    expect(text).toMatch(/Contributed: GHC 100.00/);
  });

  it("formats amounts with separators", () => {
    expect(formatGHC(1234.5)).toBe("1,234.50");
  });
});