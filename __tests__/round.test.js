/** @jest-environment node */
const {
  openRound,
  roundRecord,
  attemptsFor,
  countedAttempt,
  canLogContribution,
  nonContributors,
  allocateDebt,
  closingFloat,
  conservationResidual,
  debtResidual,
} = require("../services/round");
const { sum, formatGHC, payoutAmount, shortfall } = require("../services/money");

const AT = new Date("2026-03-06T09:00:00Z").getTime(); // a Friday
const DAY = 86400000;

const members = (count) =>
  Array.from({ length: count }, (_, i) => ({
    id: `m${i + 1}`,
    name: `Member ${i + 1}`,
    order: i,
    active: i < count,
  }));

const seedGroup = (overrides = {}) => ({
  id: "g1",
  name: "Test Susu",
  targetAmount: 300,
  collectionDay: 5,
  cycleStartedAt: AT,
  currentRound: 1,
  currentTurnIndex: 0,
  totalRounds: 3,
  isActive: true,
  members: members(3),
  contributions: [],
  payouts: [],
  ...overrides,
});

const attempt = (group, memberId, amount, status = "verified", roundNumber = 1, extra = {}) => ({
  ...group,
  contributions: [
    ...group.contributions,
    { id: `c-${memberId}-${roundNumber}-${status}`, memberId, amount, roundNumber, status, ...extra },
  ],
});

describe("round snapshot", () => {
  it("freezes the target in pesewas", () => {
    const round = openRound(seedGroup(), { at: AT });
    expect(round.target).toBe(30000);
  });

  it("freezes the roster in rotation order", () => {
    const round = openRound(seedGroup(), { at: AT });
    expect(round.roster.map((m) => m.memberId)).toEqual(["m1", "m2", "m3"]);
  });

  it("freezes each member's share, allocating the remainder to the receiver", () => {
    const group = seedGroup({ targetAmount: 100 });
    const round = openRound(group, { at: AT });
    expect(round.roster.map((m) => m.share)).toEqual([3334, 3333, 3333]);
    expect(round.roster.find((m) => m.memberId === round.receiverId).share).toBe(3334);
  });

  it("records the receiver as a fact, not an index", () => {
    const group = seedGroup({ currentTurnIndex: 2 });
    expect(openRound(group, { at: AT }).receiverId).toBe("m3");
  });

  it("always records the receiver as the first rotation position", () => {
    // The receiver receives the indivisible cedi, so the snapshot's receiver is the
    // rotation origin for share allocation regardless of the stored cursor.
    const round = openRound(seedGroup({ currentTurnIndex: 2 }), { at: AT });
    expect(round.roster[0].memberId).toBe(round.receiverId);
  });

  it("freezes the due date from when the round opened", () => {
    const openedLate = AT + 9 * DAY;
    const round = openRound(seedGroup(), { at: openedLate });
    expect(round.dueAt).toBeGreaterThan(openedLate);
  });

  it("gives a late round a full window rather than an already-expired deadline", () => {
    const openedLate = AT + 9 * DAY; // a Sunday, so the deadline would be behind us
    const round = openRound(seedGroup(), { at: openedLate });
    expect(round.dueAt).toBeGreaterThan(openedLate);
    expect(round.dueAt - openedLate).toBeLessThanOrEqual(7 * DAY);
  });

  it("survives a later removal of the receiver without silently changing the recipient", () => {
    const group = seedGroup();
    const round = openRound(group, { at: AT });
    const afterRemoval = {
      ...group,
      rounds: [round],
      members: group.members.filter((m) => m.id !== round.receiverId),
    };
    expect(roundRecord(afterRemoval, round.number).receiverId).toBe(round.receiverId);
  });

  it("keeps every snapshot share summing exactly to the target", () => {
    for (let target = 0; target < 300; target += 1) {
      for (let count = 1; count <= 6; count += 1) {
        const round = openRound(seedGroup({ targetAmount: target / 100, members: members(count) }), { at: AT });
        expect(sum(round.roster.map((m) => m.share))).toBe(round.target);
      }
    }
  });
});

describe("contribution attempts", () => {
  it("counts only verified attempts toward the pot", () => {
    const group = attempt(seedGroup(), "m1", 10000, "verified");
    expect(countedAttempt(group, "m1").amount).toBe(10000);
  });

  it("ignores an attempt that is not verified", () => {
    const group = attempt(seedGroup(), "m1", 10000, "pending");
    expect(countedAttempt(group, "m1")).toBeNull();
  });

  it("treats a flagged attempt as not counted", () => {
    const group = attempt(seedGroup(), "m1", 10000, "flagged");
    expect(countedAttempt(group, "m1")).toBeNull();
  });

  it("lists every attempt a member made, in order", () => {
    let group = attempt(seedGroup(), "m1", 5000, "failed");
    group = attempt(group, "m1", 10000, "verified");
    expect(attemptsFor(group, "m1").map((a) => a.status)).toEqual(["failed", "verified"]);
  });

  it("does not see attempts from another round", () => {
    const group = attempt(seedGroup(), "m1", 10000, "verified", 2);
    expect(attemptsFor(group, "m1", 1)).toHaveLength(0);
  });
});

describe("canLogContribution — the freeze rule", () => {
  it("allows a member who has never paid", () => {
    expect(canLogContribution(seedGroup(), "m1").ok).toBe(true);
  });

  it("blocks a second attempt while one is still verifying", () => {
    const group = attempt(seedGroup(), "m1", 10000, "pending");
    expect(canLogContribution(group, "m1").ok).toBe(false);
  });

  it("blocks a second attempt after one verified", () => {
    const group = attempt(seedGroup(), "m1", 10000, "verified");
    expect(canLogContribution(group, "m1").ok).toBe(false);
  });

  it("blocks a second attempt while one is disputed", () => {
    const group = attempt(seedGroup(), "m1", 10000, "disputed");
    expect(canLogContribution(group, "m1").ok).toBe(false);
  });

  it("PERMITS re-payment after a failed attempt", () => {
    const group = attempt(seedGroup(), "m1", 10000, "failed");
    expect(canLogContribution(group, "m1").ok).toBe(true);
  });

  it("PERMITS re-payment after a voided attempt", () => {
    const group = attempt(seedGroup(), "m1", 10000, "void");
    expect(canLogContribution(group, "m1").ok).toBe(true);
  });

  it("PERMITS re-payment after a dispute is upheld against the attempt", () => {
    const group = attempt(seedGroup(), "m1", 10000, "failed", 1, {
      dispute: { resolution: "upheld", resolvedAt: AT },
    });
    expect(canLogContribution(group, "m1").ok).toBe(true);
  });

  it("refuses a non-member", () => {
    expect(canLogContribution(seedGroup(), "stranger").ok).toBe(false);
  });

  it("never leaves a member permanently unable to pay a round", () => {
    // The exact defect in the shipped code: a failed attempt blocked re-payment forever,
    // so the round could never be paid out. Repeated cycles must never end locked.
    let group = seedGroup();
    for (const terminal of ["failed", "void", "failed", "failed"]) {
      expect(canLogContribution(group, "m1").ok).toBe(true);
      // the member pays; the attempt sits verifying
      group = attempt(group, "m1", 10000, "pending");
      expect(canLogContribution(group, "m1").ok).toBe(false);
      // the attempt settles unfavourably, and the slot must free up again
      const settled = [...group.contributions];
      settled[settled.length - 1] = { ...settled[settled.length - 1], status: terminal };
      group = { ...group, contributions: settled };
      expect(canLogContribution(group, "m1").ok).toBe(true);
    }
  });

  it("does not block a different member", () => {
    const group = attempt(seedGroup(), "m1", 10000, "verified");
    expect(canLogContribution(group, "m2").ok).toBe(true);
  });
});

describe("debt from actuals", () => {
  it("charges nobody when everyone contributed", () => {
    let group = seedGroup();
    group = attempt(group, "m1", 10000);
    group = attempt(group, "m2", 10000);
    group = attempt(group, "m3", 10000);
    expect(allocateDebt(roundRecord(group, 1), group)).toEqual({});
  });

  it("charges only the members who did not contribute", () => {
    let group = attempt(seedGroup(), "m1", 10000);
    group = attempt(group, "m3", 10000);
    expect(nonContributors(roundRecord(group, 1), group)).toEqual(["m2"]);
    expect(allocateDebt(roundRecord(group, 1), group)).toEqual({ m2: 10000 });
  });

  it("caps a charge at that member's own snapshot share", () => {
    // Target GH¢300, GH¢200 verified: a GH¢100 gap against a GH¢100 share.
    let group = attempt(seedGroup(), "m1", 10000);
    group = attempt(group, "m2", 10000);
    const round = roundRecord(group, 1);
    const share = round.roster.find((e) => e.memberId === "m3").share;
    expect(share).toBe(10000);
    expect(allocateDebt(round, group).m3).toBe(share);
  });

  it("caps the charge when the gap exceeds the shares of those who did not pay", () => {
    let group = attempt(seedGroup(), "m1", 10000);
    const debt = allocateDebt(roundRecord(group, 1), group);
    expect(debt.m2).toBe(10000);
    expect(debt.m3).toBe(10000);
    expect(sum(Object.values(debt))).toBe(20000);
  });

  it("never charges more in total than the shortfall", () => {
    let group = seedGroup();
    group = attempt(group, "m1", 5000);
    const debt = allocateDebt(roundRecord(group, 1), group);
    expect(sum(Object.values(debt))).toBeLessThanOrEqual(shortfall(30000, 5000));
  });

  it("treats a pending attempt as not a contribution", () => {
    const group = attempt(seedGroup(), "m1", 10000, "pending");
    expect(nonContributors(roundRecord(group, 1), group)).toEqual(["m1", "m2", "m3"]);
  });

  it("treats a failed attempt as not a contribution, and permits a re-payment", () => {
    const group = attempt(seedGroup(), "m1", 10000, "failed");
    expect(nonContributors(roundRecord(group, 1), group)).toEqual(["m1", "m2", "m3"]);
    expect(canLogContribution(group, "m1").ok).toBe(true);
  });

  it("splits an indivisible shortfall without losing a pesewa", () => {
    let group = seedGroup({ targetAmount: 300 });
    group = attempt(group, "m1", 20000);
    const round = roundRecord(group, 1);
    expect(sum(Object.values(allocateDebt(round, group)))).toBe(shortfall(30000, 20000));
  });

  it("splits a shortfall between several non-contributors without losing a pesewa", () => {
    const group = attempt(seedGroup(), "m1", 10000);
    const debt = allocateDebt(roundRecord(group, 1), group);
    expect(sum(Object.values(debt))).toBe(20000);
  });
});

describe("conservation", () => {
  const fee = 500;

  it("balances on a normal round with an overpayment", () => {
    const round = roundRecord(seedGroup(), 1);
    let group = attempt(seedGroup(), "m1", 10000);
    group = attempt(group, "m2", 15000);
    group = attempt(group, "m3", 10000);
    const verified = sum([10000, 15000, 10000]);
    expect(formatGHC(verified)).toBe("350.00");
    expect(formatGHC(payoutAmount(verified, fee))).toBe("345.00");
    expect(conservationResidual(round, group, { paid: 34500, fees: fee })).toBe(0);
  });

  it("balances on a short round, retaining the collected money as float", () => {
    const round = roundRecord(seedGroup(), 1);
    let group = attempt(seedGroup(), "m1", 10000);
    group = attempt(group, "m3", 10000);
    const debt = allocateDebt(round, group);
    expect(sum(Object.values(debt))).toBe(10000);
    // GH¢200 was collected and nobody was paid. All of it is float, and the GH¢100 owed
    // by the non-contributor is a claim on future money, not money that has left.
    const float = closingFloat(round, group, { paid: 0, fees: 0 });
    expect(float).toBe(20000);
    expect(conservationResidual(round, group, { paid: 0, fees: 0 })).toBe(0);
    expect(debtResidual(round, group)).toBe(0);
  });

  it("lets debt exceed what was collected, without breaking the money identity", () => {
    // Only GH¢100 collected against a GH¢300 pot. The two who did not pay still owe
    // GH¢100 each, because they owed it that week regardless of anyone else paying.
    const group = attempt(seedGroup(), "m1", 10000);
    const round = roundRecord(group, 1);
    const debt = allocateDebt(round, group);
    expect(sum(Object.values(debt))).toBe(20000);
    expect(conservationResidual(round, group, { paid: 0, fees: 0 })).toBe(0);
    expect(closingFloat(round, group, { paid: 0, fees: 0 })).toBe(10000);
  });

  it("never books more debt than the shortfall", () => {
    for (const verified of [0, 1000, 5000, 20000, 25000, 29999, 30000, 40000]) {
      let group = seedGroup();
      group = attempt(group, "m1", verified);
      const round = roundRecord(group, 1);
      expect(debtResidual(round, group)).toBeGreaterThanOrEqual(0);
    }
  });

  it("reports a residual when more was paid out than was ever collected", () => {
    // Float absorbs every ordinary imbalance, so a non-zero residual can only mean a
    // payout exceeded collection — the one unrecoverable error class.
    const round = roundRecord(seedGroup(), 1);
    const group = attempt(seedGroup(), "m1", 30000);
    expect(conservationResidual(round, group, { paid: 30000, fees: 0 })).toBe(0);
    expect(conservationResidual(round, group, { paid: 40000, fees: 0 })).toBe(-10000);
  });

  it("holds for every contribution pattern across a matrix of rounds", () => {
    const statuses = ["verified", "pending", "failed", "flagged", "disputed"];
    for (const s1 of statuses) {
      for (const s2 of statuses) {
        for (const s3 of statuses) {
          let group = attempt(seedGroup(), "m1", 10000, s1);
          group = attempt(group, "m2", 12000, s2);
          group = attempt(group, "m3", 8000, s3);
          const round = roundRecord(group, 1);
          const verified = sum(
            group.contributions.filter((c) => c.status === "verified").map((c) => c.amount)
          );
          // A full round pays out everything verified; a short round pays nothing.
          const paid = verified >= 30000 ? verified : 0;
          expect(conservationResidual(round, group, { paid, fees: 0 })).toBe(0);
        }
      }
    }
  });
});