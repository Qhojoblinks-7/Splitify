import { roundContributions } from "./susu";

/**
 * Disputes.
 *
 * Growl holds no money, so a disputed contribution cannot be "clawed back".
 * The lever is procedural: a disputed entry blocks the round, stays visible to
 * every member, and can only be cleared by an explicit recorded decision.
 */

export const DISPUTE_REASONS = [
  { id: "not_paid", label: "I never made this payment" },
  { id: "wrong_amount", label: "The amount is wrong" },
  { id: "wrong_person", label: "This was logged against the wrong member" },
  { id: "duplicate", label: "This is a duplicate entry" },
  { id: "other", label: "Something else" },
];

export const RESOLUTIONS = [
  { id: "dismissed", label: "Dismiss — the contribution stands" },
  { id: "upheld", label: "Uphold — the contribution is not valid" },
];

/**
 * Only the member whose money it is, and the admin who recorded it, have
 * standing to dispute. Any other member would be able to freeze a round.
 */
export function canDispute(group, contribution, userId) {
  if (!group || !contribution) return { ok: false, message: "That contribution is no longer available." };
  if (contribution.status === "pending" || contribution.status === "queued") {
    return { ok: false, message: "This payment is still being verified. Wait for it to settle first." };
  }
  const isOwner = contribution.memberId === userId;
  const isAdmin = group.members.some((m) => m.id === userId && m.role === "admin");
  if (!isOwner && !isAdmin) {
    return { ok: false, message: "Only the member who paid, or the group admin, can dispute this." };
  }
  return { ok: true, message: null };
}

/** A round with an open dispute cannot be paid out, whatever the totals say. */
export function openDisputes(group) {
  return (group?.contributions || []).filter((c) => c.status === "disputed");
}

export function hasOpenDispute(group, roundNumber = group?.currentRound) {
  return roundContributions(group, roundNumber).some((c) => c.status === "disputed");
}

export function canAdminResolve(group, contribution, userId) {
  if (!group || !contribution) return { ok: false, message: "That contribution is no longer available." };
  if (contribution.status !== "disputed") {
    return { ok: false, message: "There is no open dispute on this contribution." };
  }
  const isAdmin = group.members.some((m) => m.id === userId && m.role === "admin");
  if (!isAdmin) {
    return { ok: false, message: "Only the group admin can settle a dispute." };
  }
  return { ok: true, message: null };
}

/**
 * Upholding a dispute moves the amount owed onto the member who claimed it, so
 * the debt is visible on their next statement rather than lost.
 */
export function memberOwedAfterResolution(group, contribution, resolution) {
  if (resolution !== "upheld") return 0;
  return contribution.amount;
}

export function reasonLabel(reasonId) {
  return DISPUTE_REASONS.find((r) => r.id === reasonId)?.label || "Other";
}