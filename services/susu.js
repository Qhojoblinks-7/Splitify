import colors from "../theme/colors";

const CURRENT_USER_ID = "u1";

export const MIN_CONTRIBUTION = 1;
export const MAX_MEMBERS = 50;
export const MAX_MISSES_BEFORE_REMOVAL = 2;

const AVATAR_COLORS = [colors.gold, colors.avatarBlue, colors.avatarGreen, colors.amber, colors.avatarViolet, colors.avatarPink, colors.avatarCyan, colors.avatarLime, colors.danger, colors.avatarTeal];

export const PROVIDERS = [
  { id: "mtn_momo", label: "MTN MoMo", short: "MTN" },
  { id: "vodafone_cash", label: "Vodafone Cash", short: "Vod" },
  { id: "telecel_cash", label: "Telecel Cash", short: "Tele" },
];

export const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export const roundTarget = (memberCount) => (memberCount || 1) * 20;

export function initialsOf(name) {
  return String(name)
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
}

export function makeMember(partial = {}) {
  return {
    id: partial.id || `m${Math.random().toString(36).slice(2, 9)}`,
    name: partial.name || "New Member",
    phone: partial.phone || "",
    role: partial.role || "member",
    order: partial.order ?? 0,
    active: partial.active ?? true,
    missedStreak: partial.missedStreak ?? 0,
    missedShare: partial.missedShare ?? 0,
    avatarColor: partial.avatarColor || AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
    initials: initialsOf(partial.name || "New Member"),
    mobileMoney: partial.mobileMoney || "",
  };
}

export function activeMembers(group) {
  return group.members.filter((m) => m.active).sort((a, b) => a.order - b.order);
}

export function isAdmin(group, userId) {
  return group.members.some((m) => m.id === userId && m.role === "admin");
}

export function currentReceiver(group) {
  const roster = activeMembers(group);
  if (!roster.length) return null;
  return roster[group.currentTurnIndex % roster.length];
}

/** Even share each member owes per round, used for miss penalties. */
export function memberShare(group) {
  const roster = activeMembers(group);
  if (!roster.length) return 0;
  return Math.round((group.targetAmount / roster.length) * 100) / 100;
}

export function roundContributions(group, roundNumber) {
  return group.contributions.filter((c) => c.roundNumber === roundNumber);
}

export function memberContribution(group, memberId, roundNumber = group.currentRound) {
  return roundContributions(group, roundNumber).find((c) => c.memberId === memberId) || null;
}

export function roundCollected(group, roundNumber) {
  return roundContributions(group, roundNumber)
    .filter((c) => c.status === "verified")
    .reduce((sum, c) => sum + c.amount, 0);
}

/**
 * collecting -> some verified, pot not full
 * ready      -> verified contributions meet or exceed the pot
 * short      -> everyone in the roster contributed and verified, still under the pot
 */
export function roundStatus(group, roundNumber = group.currentRound) {
  const roster = activeMembers(group);
  const verified = roundContributions(group, roundNumber).filter((c) => c.status === "verified");
  const target = group.targetAmount;
  const total = verified.reduce((sum, c) => sum + c.amount, 0);

  if (total >= target) return "ready";
  if (verified.length >= roster.length && roster.length > 0) return "short";
  return "collecting";
}

export function isPayoutReady(group) {
  return group.isActive && roundStatus(group) === "ready";
}

export function groupProgress(group) {
  const totalRounds = Math.max(1, group.totalRounds);
  return Math.min(1, (group.currentRound - 1) / totalRounds);
}

/** Days remaining until the collection deadline for a round. Negative once overdue. */
export function daysUntilDue(group, from = Date.now()) {
  const due = group.currentRoundDueAt;
  if (!due) return null;
  return Math.ceil((due - from) / 86400000);
}

/**
 * Groups the user is in, is active, and has not yet contributed to the open
 * round — the answer to "what do I owe before Friday".
 */
export function dueSummary(groups, userId, from = Date.now()) {
  return groups
    .filter((g) => g.isActive && g.members.some((m) => m.id === userId))
    .filter((g) => !memberContribution(g, userId))
    .map((group) => {
      const dueAt = group.currentRoundDueAt ?? null;
      const days = daysUntilDue(group, from);
      return {
        group,
        dueAt,
        days,
        overdue: days !== null && days < 0,
        dueSoon: days !== null && days >= 0 && days <= 2,
      };
    })
    .sort((a, b) => (a.dueAt ?? Infinity) - (b.dueAt ?? Infinity));
}

/** Ambiguous glyphs (I, O, 0, 1) are left out so codes survive being read aloud. */
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const INVITE_CODE_LENGTH = 6;

export function generateInviteCode() {
  let code = "";
  for (let i = 0; i < INVITE_CODE_LENGTH; i += 1) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}

export function normalizeInviteCode(value) {
  return String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function validateInviteCodeFormat(value) {
  return normalizeInviteCode(value).length === INVITE_CODE_LENGTH;
}

export function validateContribution(group, { amount, provider, reference }, memberId = CURRENT_USER_ID) {
  const value = Number(amount);
  if (!amount || Number.isNaN(value)) {
    return { ok: false, message: "Enter an amount." };
  }
  if (value < MIN_CONTRIBUTION) {
    return { ok: false, message: `The minimum contribution is GHC ${MIN_CONTRIBUTION}.` };
  }
  if (value > group.targetAmount) {
    return { ok: false, message: `Contribution cannot be more than the pot (GHC ${group.targetAmount}).` };
  }
  if (!provider) return { ok: false, message: "Choose the mobile money you paid with." };
  if (!reference || reference.trim().length < 6) {
    return { ok: false, message: "Enter the transaction reference from your mobile money confirmation." };
  }
  if (memberContribution(group, memberId)) {
    return { ok: false, message: "You already logged a contribution for this round." };
  }
  return { ok: true, message: null };
}

export function validateGroupDraft(draft) {
  if (!draft.name.trim()) return { ok: false, message: "Give your susu group a name." };
  if (!draft.targetAmount || Number(draft.targetAmount) < 20) {
    return { ok: false, message: "Set a pot of at least GHC 20 per round." };
  }
  if (!draft.members.length) {
    return { ok: false, message: "Add at least one other member to start collecting." };
  }
  if (draft.members.length + 1 > MAX_MEMBERS) {
    return { ok: false, message: `A susu group can have at most ${MAX_MEMBERS} members.` };
  }
  const phones = draft.members.map((m) => m.phone.trim()).filter(Boolean);
  if (new Set(phones).size !== phones.length) {
    return { ok: false, message: "A member appears twice in your list." };
  }
  return { ok: true, message: null };
}

/**
 * Members who have not contributed to a settled round owe their share plus any
 * previous missed share. One miss is tolerated, a second removes them.
 */
export function nextRoundDueAt(collectionDay, cycleStartedAt, roundNumber) {
  const base = new Date(cycleStartedAt);
  const ms = (dayOfWeek) => ((collectionDay - dayOfWeek + 7) % 7) * 86400000;
  const first = new Date(base.getTime() + ms(base.getDay()) - base.getHours() * 3600000);
  const target = new Date(first.getTime() + (roundNumber - 1) * 7 * 86400000);
  target.setHours(23, 59, 0, 0);
  return target.getTime();
}

export { CURRENT_USER_ID, AVATAR_COLORS };