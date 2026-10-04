import { allocate, shortfall, sum, NO_FEE } from "./money";

/**
 * The round model.
 *
 * A round is frozen the moment it opens. The roster, each member's share, the receiver and
 * the due date are all captured as facts, because the defect this replaces was a rotation
 * index pointing into a roster that could change underneath it: removing someone silently
 * changed who was about to be paid, and a member's share moved mid-round.
 *
 * All amounts here are integer pesewas. Nothing in this module accepts cedis.
 *
 * Rule IDs refer to `1791027903-money-handling-and-safeguards.md` for money and
 * `1791026719-growth-business-logic.md` for product behaviour.
 *   R0   round snapshot, frozen at open          Z1   money identity
 *   R1   roster and shares frozen                Z2   float retained, never spent
 *   R2   receiver is a stored fact               Z2a  debt identity (separate from Z1)
 *   R3   due date measured from round open       Z7   a residual is an incident
 *   R6   rotation origin is the receiver         D2   debt from actuals
 *   C-S1 only verified counts toward the pot     D5   debt survives cycles
 *   C-S2 the freeze rule: always re-payable
 *
 * Tests: `__tests__/round.test.js` (37). Traceability: `1791028600-traceability-and-status.md` §2.2.
 */

export const ATTEMPT_STATUSES = [
  "pending",
  "queued",
  "verified",
  "failed",
  "flagged",
  "disputed",
  "void",
];

/**
 * An attempt that still holds the slot. A member may not create a second attempt while
 * one of these exists, and may re-pay once their attempt reaches a terminal state.
 */
const OPEN_ATTEMPT_STATUSES = new Set(["pending", "queued", "verified", "disputed"]);

export const DAY = 86400000;

const activeRoster = (group) =>
  group.members.filter((m) => m.active).sort((a, b) => a.order - b.order);

/** 23:59 on the next occurrence of the collection day, measured from the round opening. */
export function dueAtFrom(collectionDay, openedAt) {
  const base = new Date(openedAt);
  const offset = ((collectionDay - base.getDay() + 7) % 7) * DAY;
  const due = new Date(base.getTime() + offset);
  due.setHours(23, 59, 0, 0);
  return due.getTime();
}

/**
 * Freezes a round. The caller persists the result; the round number comes from the group
 * so the first call and a resumed call agree.
 */
export function openRound(group, { at = Date.now(), fee = NO_FEE, collectionDay } = {}) {
  const roster = activeRoster(group);
  const target = Math.round(group.targetAmount * 100);
  const day = Number.isInteger(collectionDay) ? collectionDay : group.collectionDay;

  // Rotation order starting at the receiver, so the member about to be paid absorbs the
  // indivisible cedi.
  const cursor = group.currentTurnIndex % Math.max(1, roster.length);
  const rotation = [...roster.slice(cursor), ...roster.slice(0, cursor)];
  const receiverId = rotation.length ? rotation[0].id : null;

  const shares = allocate(target, roster.length, rotation.map((m) => m.id));

  return {
    number: group.currentRound,
    cycle: group.cycle,
    target,
    receiverId,
    openedAt: at,
    dueAt: dueAtFrom(day, at),
    collectionDay: day,
    fee,
    roster: rotation.map((member) => ({
      memberId: member.id,
      name: member.name,
      order: member.order,
      share: shares[member.id],
    })),
  };
}

export function roundRecord(group, roundNumber = group.currentRound) {
  if (Array.isArray(group.rounds)) {
    const found = group.rounds.find((r) => r.number === roundNumber);
    if (found) return found;
  }
  return openRound(group);
}

export function attemptsFor(group, memberId, roundNumber = group.currentRound) {
  return group.contributions.filter((c) => c.roundNumber === roundNumber && c.memberId === memberId);
}

/** The single attempt that counts toward the pot. At most one exists by construction. */
export function countedAttempt(group, memberId, roundNumber = group.currentRound) {
  return (
    attemptsFor(group, memberId, roundNumber).find((c) => c.status === "verified") || null
  );
}

export function verifiedTotal(group, roundNumber = group.currentRound) {
  return sum(
    group.contributions
      .filter((c) => c.roundNumber === roundNumber && c.status === "verified")
      .map((c) => c.amount)
  );
}

/**
 * Whether a member may create a contribution attempt for this round.
 *
 * This is the freeze rule. A failed or voided attempt must always be re-payable, or a
 * single unverifiable reference strands the round permanently and the member with it.
 */
export function canLogContribution(group, memberId, roundNumber = group.currentRound) {
  const round = roundRecord(group, roundNumber);
  if (!round.roster.some((m) => m.memberId === memberId)) {
    return { ok: false, message: "You are not in the rotation for this round." };
  }
  const open = attemptsFor(group, memberId, roundNumber).some((c) =>
    OPEN_ATTEMPT_STATUSES.has(c.status)
  );
  if (open) {
    return { ok: false, message: "You already have a payment recorded for this round." };
  }
  return { ok: true, message: null };
}

export function nonContributors(round, group, roundNumber = round.number) {
  return round.roster
    .filter((entry) => !countedAttempt(group, entry.memberId, roundNumber))
    .map((entry) => entry.memberId);
}

/**
 * Books debt from what was actually missing, capped at each member's own frozen share.
 *
 * Proportional to each member's share, and exactly conserving: the charges always sum to
 * the shortfall, never a pesewa more. The earlier version of this function rounded each
 * member's charge independently and over-booked by a single pesewa when the shortfall was
 * smaller than the member count.
 */
export function allocateDebt(round, group, roundNumber = round.number) {
  const debtors = nonContributors(round, group, roundNumber);
  if (!debtors.length) return {};

  const gap = shortfall(round.target, verifiedTotal(group, roundNumber));
  if (gap === 0) return {};

  const shareOf = (id) => round.roster.find((entry) => entry.memberId === id).share;
  const ceiling = sum(debtors.map(shareOf));

  const debt = {};
  let remaining = Math.min(gap, ceiling);
  let active = debtors.slice();

  while (remaining > 0 && active.length) {
    const weights = sum(active.map(shareOf));

    // Provisional split, floored so no member is over-charged provisionally.
    const provisional = {};
    const fractions = [];
    active.forEach((id) => {
      const numerator = remaining * shareOf(id);
      provisional[id] = Math.floor(numerator / weights);
      fractions.push({ id, remainder: numerator - provisional[id] * weights });
    });

    // Hand the indivisible cedi to the largest fractional claims, rotation order breaking ties.
    const order = new Map(active.map((id, index) => [id, index]));
    fractions.sort((a, b) => b.remainder - a.remainder || order.get(a.id) - order.get(b.id));
    let leftover = remaining - sum(active.map((id) => provisional[id]));
    for (const { id } of fractions) {
      if (leftover <= 0) break;
      provisional[id] += 1;
      leftover -= 1;
    }

    // Cap anyone who has reached their own share and redistribute what they could not take.
    const capped = [];
    const nextActive = [];
    active.forEach((id) => {
      const share = shareOf(id);
      if (provisional[id] >= share) {
        debt[id] = share;
        remaining -= share;
        capped.push(id);
      } else {
        nextActive.push(id);
      }
    });

    if (!capped.length) {
      active.forEach((id) => {
        debt[id] = provisional[id];
      });
      remaining = 0;
    } else {
      active = nextActive;
    }
  }

  return debt;
}

/**
 * Money verified into a round that no payout consumed. It stays in the collection account,
 * attributable to the group, and reduces what the group needs to collect next round.
 *
 * Note this is money only. Debt is deliberately excluded: a debt is a claim on future
 * contributions, not a cedi that has left the pot. Charging debt here as well would deduct
 * the same funds twice.
 *
 * There is deliberately no `reversals` term. A reversed attempt is already excluded from
 * `verifiedTotal`, so subtracting it again would remove a cedi that is still in the
 * collection account — the backend shipped exactly that bug, and this signature is what
 * invited it.
 */
export function closingFloat(round, group, { paid = 0, fees = 0 } = {}) {
  const verified = verifiedTotal(group, round.number);
  const float = verified - paid - fees;
  return float > 0 ? float : 0;
}

/**
 * The money identity. Must be zero for every round, always.
 *
 *   verified − paid − fees − float = 0
 *
 * A non-zero residual therefore means money left the round that never entered it — the
 * one unrecoverable error class. Everything else balances by construction.
 */
export function conservationResidual(round, group, { paid = 0, fees = 0 } = {}) {
  const verified = verifiedTotal(group, round.number);
  const float = closingFloat(round, group, { paid, fees });
  return verified - paid - fees - float;
}

/**
 * The debt identity, kept separate from the money identity.
 *
 *   0 ≤ shortfall − ΣdebtBooked,  and  debtBooked(m) ≤ snapshotShare(m)
 *
 * Debt can legitimately exceed what was collected: members owe what they agreed to pay that
 * week, whether or not anyone else did. That is an obligation, not a movement of funds.
 */
export function debtResidual(round, group) {
  const gap = shortfall(round.target, verifiedTotal(group, round.number));
  return gap - sum(Object.values(allocateDebt(round, group)));
}

export { shortfall, sum };