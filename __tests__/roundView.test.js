/**
 * @jest-environment node
 *
 * The round view must never become a second source of truth for money.
 *
 * The defect this replaces was a screen that recomputed debt, float and the pot on the device,
 * which produced a total that contradicted the number beside it. These tests are written to fail
 * if anyone reintroduces arithmetic here, rather than to describe what the output happens to be.
 */
const { formatGHC } = require("../services/money");
const { formatSigned, toRoundView } = require("../services/roundView");

/**
 * A well-formed payload, in the exact camelCase the API sends.
 *
 * Internally consistent, because an inconsistent fixture would test nothing: 88000 collected
 * (debit partner, credit pot) plus 12000 of debt booked (debit and credit debt_receivable) gives
 * 100000 on each side of the ledger and a zero residual. Nothing has been paid out yet, so the
 * float is the whole verified total.
 */
function payload(overrides = {}) {
  return {
    id: 7,
    number: 3,
    cycle: 1,
    outcome: "open",
    targetPesewas: 100000,
    feePesewas: 0,
    openedAt: "2026-10-01T09:00:00Z",
    dueAt: "2026-10-05T23:59:00Z",
    receiverMembershipId: 2,
    roster: [
      { membershipId: 2, accountId: 20, name: "Ama", order: 0, sharePesewas: 33334, chargedPesewas: 0 },
      { membershipId: 3, accountId: 30, name: "Kofi", order: 1, sharePesewas: 33333, chargedPesewas: 12000 },
      { membershipId: 4, accountId: 40, name: "Yaa", order: 2, sharePesewas: 33333 },
    ],
    verifiedTotalPesewas: 88000,
    shortfallPesewas: 12000,
    closingFloatPesewas: 88000,
    conservationResidual: 0,
    debtResidual: 0,
    ledger: {
      debitsPesewas: 100000,
      creditsPesewas: 100000,
      residualPesewas: 0,
      partnerBalancePesewas: 88000,
      groupPotPesewas: 88000,
      debtReceivablePesewas: 12000,
      feePayablePesewas: 0,
    },
    payout: null,
    ...overrides,
  };
}

describe("the view reports what the server said, not what the device can work out", () => {
  it("shows the server's verified total even when the roster cannot justify it", () => {
    // The roster shares sum to 100000, and one member is charged 12000. A client that netted
    // debt against the pot would show 88000 - 12000 = 76000 here. The server says the pot moved
    // 88000 and the debt is a separate obligation, so the screen must say 88000.
    const view = toRoundView(payload());

    expect(view.verified).toBe("880.00");
    expect(view.shortfall).toBe("120.00");
    expect(view.float).toBe("880.00");
  });

  it("keeps debt out of the pot rather than netting it", () => {
    const view = toRoundView(payload());

    expect(view.ledger.debtReceivable).toBe("120.00");
    expect(view.ledger.groupPot).toBe("880.00");
    expect(view.ledger.partnerBalance).toBe("880.00");
  });

  it("leaves the conservation and debt identities to the server", () => {
    // Non-zero residuals are passed through verbatim. The client is not entitled to recompute
    // them into zero, and a non-zero residual is reported rather than tidied away.
    const view = toRoundView(
      payload({ conservationResidual: 7, debtResidual: -3, ledger: payload().ledger })
    );

    expect(view.conservationResidual).toBe(7);
    expect(view.debtResidual).toBe(-3);
    expect(view.balanced).toBe(false);
  });

  it("marks a round balanced only when all three identities hold", () => {
    expect(toRoundView(payload()).balanced).toBe(true);

    const brokenLedger = payload({
      ledger: { ...payload().ledger, residualPesewas: 1 },
    });
    expect(toRoundView(brokenLedger).balanced).toBe(false);
  });

  it("calls an open round with unbooked debt balanced, because that is correct", () => {
    // Debt is booked when a round closes. Mid-round the shortfall is larger than the debt
    // booked so far, and that gap is the honest state of the round, not a fault. Demanding a
    // zero debt residual here would put a "this round does not balance" warning in front of
    // every member of every group that has not finished collecting yet.
    const openRound = payload({
      verifiedTotalPesewas: 0,
      shortfallPesewas: 100000,
      closingFloatPesewas: 0,
      debtResidual: 100000,
      roster: payload().roster.map(({ chargedPesewas, ...rest }) => rest),
    });

    expect(toRoundView(openRound).balanced).toBe(true);
  });

  it("calls a round unbalanced when debt was booked beyond what members owe", () => {
    // The one thing the debt residual must never do is go negative.
    const overBooked = payload({ debtResidual: -1 });

    expect(toRoundView(overBooked).balanced).toBe(false);
  });
});

describe("signed amounts survive the trip to the screen", () => {
  it("formats a negative partner balance instead of throwing", () => {
    // A reversal after a payout legitimately leaves the partner account negative. That state is
    // representable, so the screen must not crash on it.
    const view = toRoundView(
      payload({
        ledger: { ...payload().ledger, partnerBalancePesewas: -15050 },
      })
    );

    expect(view.ledger.partnerBalance).toBe("-150.50");
  });

  it("documents why formatGHC could not be used for that field", () => {
    // The reason `formatSigned` exists at all: the shared formatter asserts a non-negative
    // amount and throws. If that ever stops being true, this test fails and says so.
    expect(() => formatGHC(-100)).toThrow(/non-negative|pesewas/i);
    expect(formatSigned(-100)).toBe("-1.00");
  });

  it("degrades a missing or malformed amount instead of taking the screen down", () => {
    expect(formatSigned(undefined)).toBe("—");
    expect(formatSigned(null)).toBe("—");
    expect(formatSigned(Number.NaN)).toBe("—");
    expect(formatSigned(10.5)).toBe("—");
  });
});

describe("the frozen roster is carried through intact", () => {
  it("keeps the server's order, which is the rotation with the receiver first", () => {
    const view = toRoundView(payload());

    expect(view.roster.map((entry) => entry.name)).toEqual(["Ama", "Kofi", "Yaa"]);
    expect(view.roster[0].isReceiver).toBe(true);
    expect(view.roster[1].isReceiver).toBe(false);
  });

  it("treats an absent charge as nothing owed", () => {
    // `chargedPesewas` is omitted from the wire when a member owes nothing, so reading it
    // straight through would show an undefined amount beside their name.
    const view = toRoundView(payload());

    expect(view.roster[2].charged).toBe("0.00");
    expect(view.roster[2].owes).toBe(false);
    expect(view.roster[1].owes).toBe(true);
  });

  it("formats each member's frozen share, including the indivisible cedi", () => {
    const view = toRoundView(payload());

    expect(view.roster.map((entry) => entry.share)).toEqual(["333.34", "333.33", "333.33"]);
  });
});

describe("what each member has actually paid comes from the server", () => {
  it("marks a member paid from their own verified total, not from the round's", () => {
    const withPayment = payload({
      roster: [
        { membershipId: 2, accountId: 20, name: "Ama", order: 0, sharePesewas: 33334, paidPesewas: 33334, openStatus: "verified" },
        { membershipId: 3, accountId: 30, name: "Kofi", order: 1, sharePesewas: 33333, paidPesewas: 0 },
        { membershipId: 4, accountId: 40, name: "Yaa", order: 2, sharePesewas: 33333, paidPesewas: 0 },
      ],
      myMembershipId: 2,
      canContribute: false,
      openContributionId: 99,
    });

    const view = toRoundView(withPayment);

    expect(view.roster[0].paid).toBe("333.34");
    expect(view.roster[0].hasPaid).toBe(true);
    expect(view.roster[0].isMe).toBe(true);
    expect(view.roster[1].hasPaid).toBe(false);
    // Only one member paid, so the pot cannot have taken the round's whole verified total. A
    // client that inferred `hasPaid` from the round total would call all three paid.
    expect(view.roster.filter((entry) => entry.hasPaid)).toHaveLength(1);
  });

  it("treats a missing paid field as nothing paid rather than unreadable", () => {
    const view = toRoundView(payload());

    expect(view.roster.every((entry) => entry.paid === "0.00")).toBe(true);
  });

  it("uses the server's answer on whether this member may pay", () => {
    // The freeze rule. A member holding an unsettled attempt must not be able to open a second,
    // and only the server knows what is unsettled. Anything truthy-but-not-true must not open
    // the button, or the screen would offer a write the server refuses.
    expect(toRoundView(payload({ canContribute: true })).canContribute).toBe(true);
    expect(toRoundView(payload({ canContribute: false })).canContribute).toBe(false);
    expect(toRoundView(payload({ canContribute: "yes" })).canContribute).toBe(false);
    expect(toRoundView({ id: 1, number: 1 }).canContribute).toBe(false);
  });

  it("carries the open attempt so it can be withdrawn", () => {
    const view = toRoundView(payload({ openContributionId: 77 }));

    expect(view.openContributionId).toBe(77);
    expect(toRoundView(payload({ openContributionId: null })).openContributionId).toBeNull();
  });
});

describe("a round that cannot be read says so", () => {
  it("survives a payload with no roster and no ledger", () => {
    const view = toRoundView({ id: 1, number: 1, cycle: 1, outcome: "open", targetPesewas: 0, feePesewas: 0 });

    expect(view.roster).toEqual([]);
    expect(view.ledger.residual).toBe("0.00");
    expect(view.payout).toBeNull();
  });

  it("shows a payout read-only, with no way to trigger one", () => {
    const view = toRoundView(
      payload({
        payout: {
          id: 1,
          payoutKey: "po_123",
          amountPesewas: 88000,
          feePesewas: 2500,
          status: "completed",
          receiverMembershipId: 2,
          completedAt: "2026-10-10T10:00:00Z",
        },
      })
    );

    expect(view.payout).toEqual({
      status: "completed",
      amount: "880.00",
      fee: "25.00",
      completedAt: "2026-10-10T10:00:00Z",
      receiverMembershipId: 2,
    });
  });
});