/**
 * The round, as the server described it, shaped for display.
 *
 * Every function here is a *projection*, not a calculation. Each amount is read from a field
 * the backend computed and then formatted; none is derived, rounded, adjusted or netted here.
 * That is the whole point of this module existing as its own file: the defect this replaces was
 * a screen that recomputed debt and float on the device, so the total and the number beside it
 * could contradict each other, and neither had to be wrong about the ledger to do it.
 *
 * Two consequences worth stating, because they are what the tests pin:
 *
 *   - There is no arithmetic on money anywhere in this file. `verified − paid − float` lives in
 *     `Round.conservation_residual()` on the server, and it is read, not reproduced. Duplicating
 *     it here would create a second source of truth for the one number that must never be
 *     ambiguous.
 *   - A non-zero residual is reported, not absorbed. The server states it must be zero; a client
 *     that quietly rendered a plausible total anyway would be the bug. Z1, Z7.
 *
 * Signed amounts are formatted by `formatSigned`, not `formatGHC`. `formatGHC` asserts a
 * non-negative integer and throws otherwise, which is the right contract for an amount owed —
 * but `partnerBalance` is *documented* to go negative when a reversal follows a payout, and the
 * residuals are signed diagnostics. Formatting those with `formatGHC` would crash the round
 * screen on exactly the state the ledger work made representable.
 *
 * Rule IDs: 1791027903-money-handling-and-safeguards.md Z1, Z2, Z7, C-S1, C-S8
 *            1791028270-security-fraud-and-identity.md   AT1, AT4
 */

import { formatGHC } from "./money";

/**
 * Formats any amount that arrives on the wire, whether or not it was expected.
 *
 * Every field goes through this rather than `formatGHC`, for two reasons that turned out to be
 * the same reason. `formatGHC` throws on a negative amount, and a negative `partnerBalance` is
 * a documented state; and it throws on `undefined`, which is what an unexpected payload sends.
 * Either one would take the round screen down over a display concern, so the guard lives here
 * instead: an unreadable field renders as a dash and the rest of the round still shows.
 */
export function formatSigned(pesewas) {
  if (typeof pesewas !== "number" || !Number.isSafeInteger(pesewas)) {
    return "—";
  }
  return pesewas < 0 ? `-${formatGHC(Math.abs(pesewas))}` : formatGHC(pesewas);
}

const isZero = (value) => value === 0;

/**
 * `round` as returned by `GET /api/groups/<id>/rounds/current/` or `/api/rounds/<id>/`.
 *
 * The roster is left in the order the server sent it. That order is the frozen rotation, with
 * the receiver first, so re-sorting it here would discard a fact the snapshot exists to carry.
 */
export function toRoundView(round) {
  const ledger = round.ledger ?? {};

  return {
    id: round.id,
    number: round.number,
    cycle: round.cycle,
    outcome: round.outcome,
    groupName: round.groupName,

    openedAt: round.openedAt,
    dueAt: round.dueAt,
    receiverMembershipId: round.receiverMembershipId,

    target: formatSigned(round.targetPesewas),
    verified: formatSigned(round.verifiedTotalPesewas),
    shortfall: formatSigned(round.shortfallPesewas),
    float: formatSigned(round.closingFloatPesewas),
    fee: formatSigned(round.feePesewas),

    /**
     * A member's debt, straight from the snapshot, and where their own money stands.
     *
     * `paid` and `openStatus` are read, never inferred. Whether a member may pay is the freeze
     * rule (C-S2) — a member holding an unsettled attempt must not open a second one — and it
     * has been got wrong on the client before. So `canContribute` below is the server's answer,
     * used to decide whether to draw a button, never to justify the write that follows.
     */
    roster: (round.roster ?? []).map((entry) => ({
      membershipId: entry.membershipId,
      name: entry.name,
      order: entry.order,
      share: formatSigned(entry.sharePesewas),
      charged: formatSigned(entry.chargedPesewas ?? 0),
      paid: formatSigned(entry.paidPesewas ?? 0),
      owes: (entry.chargedPesewas ?? 0) > 0,
      hasPaid: (entry.paidPesewas ?? 0) > 0,
      openStatus: entry.openStatus ?? null,
      isReceiver: entry.membershipId === round.receiverMembershipId,
      isMe: entry.membershipId === round.myMembershipId,
    })),

    /** The server's answer to "may I pay right now", not this device's guess. C-S2. */
    canContribute: round.canContribute === true,
    openContributionId: round.openContributionId ?? null,
    myMembershipId: round.myMembershipId ?? null,

    ledger: {
      debits: formatSigned(ledger.debitsPesewas ?? 0),
      credits: formatSigned(ledger.creditsPesewas ?? 0),
      residual: formatSigned(ledger.residualPesewas ?? 0),
      partnerBalance: formatSigned(ledger.partnerBalancePesewas ?? 0),
      groupPot: formatSigned(ledger.groupPotPesewas ?? 0),
      debtReceivable: formatSigned(ledger.debtReceivablePesewas ?? 0),
      feePayable: formatSigned(ledger.feePayablePesewas ?? 0),
    },

    /**
     * Whether the books agree with themselves. A client that sees `false` is looking at a
     * backend problem, and is told so rather than shown a tidy total.
     *
     * The three conditions are not the same kind of check, and treating them as if they were
     * raises a false alarm on every healthy round:
     *
     *   ledger residual        zero always. The append-only ledger balances or it is broken.
     *   conservation residual  zero always. Money identity; verified − paid − fees − float.
     *   debt residual          NOT zero. The identity is `0 <= shortfall − debt booked`, because
     *                         debt is booked when a round closes. Part-way through a round the
     *                         unbooked remainder is a correct and expected number, and demanding
     *                         zero would accuse the server of being broken while it is fine.
     *                         What it must never do is go negative: that is debt booked beyond
     *                         what members actually owe. Z2a.
     */
    balanced:
      isZero(ledger.residualPesewas ?? 0) &&
      isZero(round.conservationResidual ?? 0) &&
      (round.debtResidual ?? 0) >= 0,

    conservationResidual: round.conservationResidual ?? 0,
    debtResidual: round.debtResidual ?? 0,

     payout: round.payout
      ? {
          status: round.payout.status,
          amount: formatSigned(round.payout.amountPesewas),
          fee: formatSigned(round.payout.feePesewas),
          completedAt: round.payout.completedAt ?? null,
          receiverMembershipId: round.payout.receiverMembershipId,
        }
      : null,
  };
}

export default toRoundView;