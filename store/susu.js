import { create } from "zustand";
import { useSessionStore } from "./session";
import {
  CURRENT_USER_ID,
  MAX_MISSES_BEFORE_REMOVAL,
  MAX_MEMBERS,
  makeMember,
  activeMembers,
  currentReceiver,
  memberShare,
  roundStatus,
  roundContributions,
  memberContribution,
  isPayoutReady,
  nextRoundDueAt,
  generateInviteCode,
  normalizeInviteCode,
} from "../services/susu";
import { canDispute, canAdminResolve, hasOpenDispute, memberOwedAfterResolution } from "../services/dispute";
import colors from "../theme/colors";

const now = Date.now();
const DAY = 86400000;

const seedMembers = [
  makeMember({ id: "u1", name: "John Doe", phone: "+233 244 123 567", role: "admin", order: 0, avatarColor: colors.gold }),
  makeMember({ id: "u2", name: "Ama Boateng", phone: "+233 244 123 4567", order: 1, avatarColor: colors.avatarBlue }),
  makeMember({ id: "u3", name: "Kofi Mensah", phone: "+233 244 555 9876", order: 2, avatarColor: colors.avatarGreen }),
  makeMember({ id: "u4", name: "Sarah Johnson", phone: "+233 244 555 4321", order: 3, avatarColor: colors.avatarViolet }),
  makeMember({ id: "u5", name: "Kwame Asante", phone: "+233 244 555 1357", order: 4, avatarColor: colors.amber, missedStreak: 1, missedShare: 100 }),
];

const seedGroups = [
  {
    id: "g1",
    name: "Market Association Susu",
    description: "Weekly contributions for the traders' association. The pot is paid out every Friday.",
    targetAmount: 500,
    totalRounds: 5,
    currentRound: 3,
    currentTurnIndex: 2,
    cycle: 1,
    collectionDay: 5,
    cycleStartedAt: now - DAY * 38,
    currentRoundDueAt: now + DAY * 2,
    isActive: true,
    createdAt: now - DAY * 42,
    createdBy: "u1",
    adminTrustScore: 100,
    flaggedTotal: 0,
    inviteCode: "MK7QW2",
    fee: 25,
    members: seedMembers,
    contributions: [
      { id: "c1", roundNumber: 1, memberId: "u1", amount: 120, provider: "mtn_momo", reference: "MP260114.0932", status: "verified", paidAt: now - DAY * 34, verifiedAt: now - DAY * 34 },
      { id: "c2", roundNumber: 1, memberId: "u2", amount: 100, provider: "vodafone_cash", reference: "VC260114.5541", status: "verified", paidAt: now - DAY * 34, verifiedAt: now - DAY * 34 },
      { id: "c3", roundNumber: 1, memberId: "u3", amount: 130, provider: "mtn_momo", reference: "MP260115.1102", status: "verified", paidAt: now - DAY * 34, verifiedAt: now - DAY * 34 },
      { id: "c4", roundNumber: 1, memberId: "u4", amount: 100, provider: "telecel_cash", reference: "TC260115.7781", status: "verified", paidAt: now - DAY * 34, verifiedAt: now - DAY * 34 },
      { id: "c5", roundNumber: 1, memberId: "u5", amount: 150, provider: "mtn_momo", reference: "MP260115.8890", status: "verified", paidAt: now - DAY * 34, verifiedAt: now - DAY * 34 },
      { id: "c6", roundNumber: 2, memberId: "u2", amount: 125, provider: "mtn_momo", reference: "MP260121.2211", status: "verified", paidAt: now - DAY * 27, verifiedAt: now - DAY * 27 },
      { id: "c7", roundNumber: 2, memberId: "u3", amount: 125, provider: "mtn_momo", reference: "MP260121.3345", status: "verified", paidAt: now - DAY * 27, verifiedAt: now - DAY * 27 },
      { id: "c8", roundNumber: 2, memberId: "u4", amount: 125, provider: "vodafone_cash", reference: "VC260122.6677", status: "verified", paidAt: now - DAY * 27, verifiedAt: now - DAY * 27 },
      { id: "c9", roundNumber: 2, memberId: "u5", amount: 125, provider: "telecel_cash", reference: "TC260122.4410", status: "verified", paidAt: now - DAY * 27, verifiedAt: now - DAY * 27 },
      { id: "c10", roundNumber: 3, memberId: "u2", amount: 200, provider: "mtn_momo", reference: "MP260128.9911", status: "verified", paidAt: now - DAY * 14, verifiedAt: now - DAY * 14 },
      { id: "c11", roundNumber: 3, memberId: "u3", amount: 200, provider: "vodafone_cash", reference: "VC260128.1180", status: "failed", paidAt: now - DAY * 2, failedReason: "Reference not found with Vodafone Cash" },
      { id: "c12", roundNumber: 3, memberId: "u4", amount: 100, provider: "telecel_cash", reference: "TC260129.8823", status: "flagged", paidAt: now - DAY * 2 },
    ],
    payouts: [
      { id: "p1", roundNumber: 1, memberId: "u1", amount: 500, status: "completed", reference: "PAY260118.4432", completedAt: now - DAY * 32 },
      { id: "p2", roundNumber: 2, memberId: "u2", amount: 500, status: "completed", reference: "PAY260125.7781", completedAt: now - DAY * 25 },
    ],
  },
  {
    id: "g2",
    name: "Family Susu",
    description: "Small family group saving towards school fees.",
    targetAmount: 300,
    totalRounds: 3,
    currentRound: 1,
    currentTurnIndex: 0,
    cycle: 1,
    collectionDay: 1,
    cycleStartedAt: now - DAY * 6,
    currentRoundDueAt: now + DAY * 1,
    isActive: true,
    createdAt: now - DAY * 6,
    createdBy: "u1",
    adminTrustScore: 100,
    flaggedTotal: 0,
    inviteCode: "FAM304",
    fee: 10,
    members: [
      makeMember({ id: "u1", name: "John Doe", phone: "+233 244 123 567", role: "admin", order: 0, avatarColor: colors.gold }),
      makeMember({ id: "u6", name: "Ama Aboagye", phone: "+233 244 555 2468", order: 1, avatarColor: colors.avatarPink }),
      makeMember({ id: "u7", name: "Daniel Osei", phone: "+233 244 555 1111", order: 2, avatarColor: colors.avatarTeal }),
    ],
    contributions: [
      { id: "d1", roundNumber: 1, memberId: "u6", amount: 100, provider: "mtn_momo", reference: "MP260201.5512", status: "verified", paidAt: now - DAY * 1, verifiedAt: now - DAY * 1 },
    ],
    payouts: [],
  },
];

function withDueDates(group) {
  return {
    ...group,
    currentRoundDueAt: nextRoundDueAt(group.collectionDay, group.cycleStartedAt, group.currentRound),
  };
}

const uniqueInviteCode = (groups) => {
  const taken = new Set(groups.map((g) => g.inviteCode).filter(Boolean));
  let code = generateInviteCode();
  while (taken.has(code)) code = generateInviteCode();
  return code;
};

export const useSusuStore = create((set, get) => ({
  groups: seedGroups,
  userId: useSessionStore.getState().user?.id || CURRENT_USER_ID,
  isLoading: false,
  loadError: null,

  /**
   * Stands in for the group fetch. There is no backend yet, so this resolves
   * locally and flips `isLoading`/`loadError` exactly as the real call will,
   * which keeps every screen's loading and error UI honest to wire up later.
   */
  loadGroups: async ({ fail = false } = {}) => {
    set({ isLoading: true, loadError: null });
    await new Promise((resolve) => setTimeout(resolve, 450));
    if (fail) {
      set({ isLoading: false, loadError: "We could not load your susu groups." });
      return false;
    }
    set({ isLoading: false, loadError: null });
    return true;
  },

  syncUserFromSession: () => {
    const id = useSessionStore.getState().user?.id;
    if (id) set({ userId: id });
  },

  createGroup: (draft) => {
    const members = [
      makeMember({
        id: get().userId,
        name: draft.adminName || "You",
        phone: draft.adminPhone || "",
        role: "admin",
        order: 0,
        avatarColor: colors.gold,
      }),
      ...draft.members.map((m, index) =>
        makeMember({
          name: m.name,
          phone: m.phone,
          order: index + 1,
          role: "member",
          mobileMoney: m.mobileMoney,
        })
      ),
    ];

    const cycleStartedAt = Date.now();
    const group = withDueDates({
      id: `g${Date.now()}`,
      name: draft.name.trim(),
      description: draft.description?.trim() || "",
      targetAmount: Number(draft.targetAmount),
      totalRounds: Number(draft.totalRounds) || members.length,
      currentRound: 1,
      currentTurnIndex: 0,
      cycle: 1,
      collectionDay: Number.isInteger(draft.collectionDay) ? draft.collectionDay : 1,
      fee: Number.isFinite(Number(draft.fee)) ? Number(draft.fee) : 0,
      cycleStartedAt,
      currentRoundDueAt: null,
      isActive: true,
      createdAt: Date.now(),
      createdBy: get().userId,
      adminTrustScore: 100,
      flaggedTotal: 0,
      inviteCode: uniqueInviteCode(get().groups),
      members,
      contributions: [],
      payouts: [],
    });

    set((state) => ({ groups: [group, ...state.groups] }));
    return group.id;
  },

  /**
   * Join an existing group with an invite code. The joiner is appended to the
   * end of the rotation so they never steal someone's turn.
   */
  joinGroup: (rawCode, member = {}) => {
    const code = normalizeInviteCode(rawCode);
    const state = get();
    const group = state.groups.find((g) => g.inviteCode === code);

    if (!group) {
      return { ok: false, message: "That code does not match any susu group." };
    }
    if (!group.isActive) {
      return { ok: false, message: "This susu group has already ended." };
    }
    if (group.members.some((m) => m.id === state.userId)) {
      return { ok: false, message: "You are already in this susu group." };
    }
    if (group.members.length >= MAX_MEMBERS) {
      return { ok: false, message: "This group is full." };
    }
    const phone = (member.phone || "").trim();
    if (phone && group.members.some((m) => m.phone && m.phone === phone)) {
      return { ok: false, message: "That phone number is already in this group." };
    }

    const nextOrder = Math.max(...group.members.map((m) => m.order)) + 1;

    set((s) => ({
      groups: s.groups.map((g) =>
        g.id === group.id
          ? {
              ...g,
              totalRounds: Math.max(g.totalRounds, nextOrder + 1),
              members: [
                ...g.members,
                makeMember({
                  id: state.userId,
                  name: member.name || "New member",
                  phone,
                  mobileMoney: member.mobileMoney || "",
                  role: "member",
                  order: nextOrder,
                }),
              ],
            }
          : g
      ),
    }));

    return { ok: true, message: null, groupId: group.id, groupName: group.name };
  },

  regenerateInviteCode: (groupId) =>
    set((state) => ({
      groups: state.groups.map((g) =>
        g.id === groupId ? { ...g, inviteCode: uniqueInviteCode(state.groups) } : g
      ),
    })),

  addMember: (groupId, member) =>
    set((state) => ({
      groups: state.groups.map((group) => {
        if (group.id !== groupId) return group;
        if (group.members.length >= 50) return group;
        if (member.phone && group.members.some((m) => m.phone && m.phone === member.phone)) return group;
        const nextOrder = Math.max(...group.members.map((m) => m.order)) + 1;
        return {
          ...group,
          totalRounds: Math.max(group.totalRounds, nextOrder + 1),
          members: [...group.members, makeMember({ ...member, order: nextOrder })],
        };
      }),
    })),

  removeMember: (groupId, memberId) =>
    set((state) => ({
      groups: state.groups.map((group) => {
        if (group.id !== groupId) return group;
        if (group.members.length <= 2) return group;
        const members = group.members
          .filter((m) => m.id !== memberId)
          .sort((a, b) => a.order - b.order)
          .map((m, index) => ({ ...m, order: index }));
        const receiver = currentReceiver(group);
        return {
          ...group,
          members,
          currentTurnIndex: receiver && receiver.id === memberId ? 0 : group.currentTurnIndex,
        };
      }),
    })),

  logContribution: (groupId, payload) => {
    const memberId = get().userId;
    return set((state) => ({
      groups: state.groups.map((group) => {
        if (group.id !== groupId) return group;
        return {
          ...group,
          contributions: [
            ...group.contributions,
            {
              id: `c${Date.now()}`,
              roundNumber: group.currentRound,
              memberId,
              amount: Number(payload.amount),
              provider: payload.provider,
              reference: payload.reference.trim(),
              status: "pending",
              syncState: payload.syncState || "online",
              queueId: payload.queueId || null,
              paidAt: Date.now(),
            },
          ],
        };
      }),
    }));
  },

  markContributionSynced: (groupId, reference, syncState) =>
    set((state) => ({
      groups: state.groups.map((group) =>
        group.id === groupId
          ? {
              ...group,
              contributions: group.contributions.map((c) =>
                c.reference === reference ? { ...c, syncState } : c
              ),
            }
          : group
      ),
    })),

  verifyContribution: (groupId, contributionId) =>
    set((state) => ({
      groups: state.groups.map((group) =>
        group.id === groupId
          ? {
              ...group,
              contributions: group.contributions.map((c) =>
                c.id === contributionId ? { ...c, status: "verified", verifiedAt: Date.now() } : c
              ),
            }
          : group
      ),
    })),

  failContribution: (groupId, contributionId, reason) =>
    set((state) => ({
      groups: state.groups.map((group) =>
        group.id === groupId
          ? {
              ...group,
              contributions: group.contributions.map((c) =>
                c.id === contributionId ? { ...c, status: "failed", failedReason: reason } : c
              ),
            }
          : group
      ),
    })),

  /**
   * Admin liability: a flagged (fake) transaction blocks the round, debits the
   * admin's trust score, and strips admin rights once twice flagged.
   */
  flagContribution: (groupId, contributionId) => {
    const group = get().groups.find((g) => g.id === groupId);
    const contribution = group?.contributions.find((c) => c.id === contributionId);
    if (!group || !contribution) return null;

    const nextFlags = (group.flaggedTotal || 0) + 1;
    const nextScore = Math.max(0, (group.adminTrustScore ?? 100) - 25);
    const revoked = nextFlags >= MAX_MISSES_BEFORE_REMOVAL;

    // Losing admin rights must hand over, or the group is left with nobody able
    // to verify contributions or release a payout.
    const outgoing = group.members.find((m) => m.role === "admin");
    const successor = revoked
      ? activeMembers(group).find((m) => m.id !== outgoing?.id) || null
      : null;

    set((state) => ({
      groups: state.groups.map((g) => {
        if (g.id !== groupId) return g;
        return {
          ...g,
          flaggedTotal: nextFlags,
          adminTrustScore: nextScore,
          createdBy: successor ? successor.id : g.createdBy,
          members: g.members.map((m) => {
            if (!revoked) return m;
            if (m.id === outgoing?.id) return { ...m, role: "member" };
            if (successor && m.id === successor.id) return { ...m, role: "admin" };
            return m;
          }),
          contributions: g.contributions.map((c) =>
            c.id === contributionId ? { ...c, status: "flagged" } : c
          ),
        };
      }),
    }));

    return {
      trustScore: nextScore,
      flaggedTotal: nextFlags,
      adminRevoked: revoked,
      newAdminId: successor?.id || null,
    };
  },

  /** A member or the admin challenges a contribution. Blocks the round until settled. */
  openDispute: (groupId, contributionId, { reason, note, openedBy }) => {
    const group = get().groups.find((g) => g.id === groupId);
    const contribution = group?.contributions.find((c) => c.id === contributionId);
    const guard = canDispute(group, contribution, openedBy);
    if (!guard.ok) return null;

    set((state) => ({
      groups: state.groups.map((g) =>
        g.id !== groupId
          ? g
          : {
              ...g,
              contributions: g.contributions.map((c) =>
                c.id === contributionId
                  ? {
                      ...c,
                      // The original verification result is kept so a dismissed
                      // dispute can restore it instead of guessing.
                      disputedFrom: c.status,
                      status: "disputed",
                      dispute: {
                        reason,
                        note: (note || "").trim(),
                        openedBy,
                        openedAt: Date.now(),
                        resolution: null,
                        resolvedBy: null,
                        resolvedAt: null,
                      },
                    }
                  : c
              ),
            }
      ),
    }));

    return { contributionId, reason };
  },

  /**
   * Settles an open dispute. Dismissed restores the previous status and returns
   * the trust score the flag took away; upheld converts the amount into a debt
   * on the member who claimed it.
   */
  resolveDispute: (groupId, contributionId, { resolution, resolvedBy }) => {
    const group = get().groups.find((g) => g.id === groupId);
    const contribution = group?.contributions.find((c) => c.id === contributionId);
    const guard = canAdminResolve(group, contribution, resolvedBy);
    if (!guard.ok) return null;

    const dismissed = resolution === "dismissed";
    // Dismissing reverses the original finding. When the finding was a flag,
    // the flag itself is overturned, otherwise settling the dispute would be a
    // no-op and the round could never unblock.
    const preDispute = contribution.disputedFrom || "verified";
    const restoredStatus = !dismissed
      ? "failed"
      : preDispute === "flagged"
        ? "verified"
        : preDispute;
    // The trust cost is only undone when the flag it caused is genuinely gone.
    const unflagged = dismissed && restoredStatus !== "flagged";
    const nextFlags = unflagged ? Math.max(0, (group.flaggedTotal || 0) - 1) : group.flaggedTotal || 0;
    const nextScore = unflagged
      ? Math.min(100, (group.adminTrustScore ?? 100) + 25)
      : group.adminTrustScore ?? 100;
    const owed = memberOwedAfterResolution(group, contribution, resolution);

    set((state) => ({
      groups: state.groups.map((g) => {
        if (g.id !== groupId) return g;
        return {
          ...g,
          flaggedTotal: nextFlags,
          adminTrustScore: nextScore,
          members: g.members.map((m) =>
            !dismissed && owed > 0 && m.id === contribution.memberId
              ? { ...m, missedShare: Math.round((m.missedShare + owed) * 100) / 100 }
              : m
          ),
          contributions: g.contributions.map((c) =>
            c.id === contributionId
              ? {
                  ...c,
                  status: restoredStatus,
                  disputedFrom: undefined,
                  dispute: {
                    ...(c.dispute || {}),
                    resolution,
                    resolvedBy,
                    resolvedAt: Date.now(),
                  },
                }
              : c
          ),
        };
      }),
    }));

    return { resolution, restoredStatus, owed, trustScore: nextScore, flaggedTotal: nextFlags };
  },

  /** Payout moves pending -> processing; the round only advances on completion. */
  releasePayout: (groupId) => {
    const group = get().groups.find((g) => g.id === groupId);
    if (!group || !isPayoutReady(group)) return null;
    // An open dispute freezes the round even when the totals already add up.
    if (hasOpenDispute(group)) return null;
    const receiver = currentReceiver(group);
    if (!receiver) return null;

    const payout = {
      id: `p${Date.now()}`,
      roundNumber: group.currentRound,
      memberId: receiver.id,
      amount: group.targetAmount,
      fee: group.fee || 0,
      status: "processing",
      reference: `PAY${Date.now().toString().slice(-8)}`,
      startedAt: Date.now(),
    };

    set((state) => ({
      groups: state.groups.map((g) => (g.id === groupId ? { ...g, payouts: [...g.payouts, payout] } : g)),
    }));

    return { payout, receiver };
  },

  confirmPayout: (groupId, payoutId) => {
    const group = get().groups.find((g) => g.id === groupId);
    const payout = group?.payouts.find((p) => p.id === payoutId);
    if (!group || !payout) return null;

    const nextRound = group.currentRound + 1;
    const finished = nextRound > group.totalRounds;

    set((state) => ({
      groups: state.groups.map((g) => {
        if (g.id !== groupId) return g;
        return withDueDates({
          ...g,
          payouts: g.payouts.map((p) =>
            p.id === payoutId ? { ...p, status: "completed", completedAt: Date.now() } : p
          ),
          currentRound: finished ? g.currentRound : nextRound,
          currentTurnIndex: finished
            ? g.currentTurnIndex
            : (g.currentTurnIndex + 1) % Math.max(1, activeMembers(g).length),
          isActive: !finished,
        });
      }),
    }));

    return { finished };
  },

  failPayout: (groupId, payoutId, reason) =>
    set((state) => ({
      groups: state.groups.map((g) =>
        g.id === groupId
          ? {
              ...g,
              payouts: g.payouts.map((p) =>
                p.id === payoutId ? { ...p, status: "failed", failedReason: reason } : p
              ),
            }
          : g
      ),
    })),

  /**
   * Closes a round that ran past its due date without reaching the pot.
   * Non-contributors accrue a missed share and a strike; a second strike
   * removes them from the rotation.
   */
  closeRound: (groupId) => {
    const group = get().groups.find((g) => g.id === groupId);
    if (!group) return null;

    const share = memberShare(group);
    const receiver = currentReceiver(group);
    const nonContributors = activeMembers(group)
      .filter((m) => !memberContribution(group, m.id, group.currentRound))
      .map((m) => m.id);
    const receiverSkipped = receiver ? nonContributors.includes(receiver.id) : false;
    const nextRound = group.currentRound + 1;
    const finished = nextRound > group.totalRounds;

    set((state) => ({
      groups: state.groups.map((g) => {
        if (g.id !== groupId) return g;
        const members = g.members.map((m) => {
          if (!nonContributors.includes(m.id)) return m;
          const missedStreak = m.missedStreak + 1;
          return {
            ...m,
            missedStreak,
            missedShare: Math.round((m.missedShare + share) * 100) / 100,
            active: missedStreak < MAX_MISSES_BEFORE_REMOVAL,
          };
        });
        const stillActive = members.filter((m) => m.active).length;
        return withDueDates({
          ...g,
          members,
          payouts: [
            ...g.payouts,
            {
              id: `p${Date.now()}`,
              roundNumber: g.currentRound,
              memberId: receiver?.id || null,
              amount: 0,
              status: "skipped",
              reason: "Round closed below the pot target",
              completedAt: Date.now(),
            },
          ],
          currentRound: finished ? g.currentRound : nextRound,
          currentTurnIndex: receiverSkipped
            ? g.currentTurnIndex
            : (g.currentTurnIndex + 1) % Math.max(1, stillActive),
          isActive: finished ? false : stillActive > 1,
        });
      }),
    }));

    return { missedCount: nonContributors.length, finished };
  },

  restartCycle: (groupId) =>
    set((state) => ({
      groups: state.groups.map((group) =>
        group.id === groupId
          ? withDueDates({
              ...group,
              currentRound: 1,
              currentTurnIndex: 0,
              cycle: group.cycle + 1,
              cycleStartedAt: Date.now(),
              isActive: true,
              members: group.members.map((m) => ({ ...m, missedStreak: 0, missedShare: 0, active: true })),
            })
          : group
      ),
    })),

  endGroup: (groupId) =>
    set((state) => ({
      groups: state.groups.map((group) =>
        group.id === groupId ? { ...group, isActive: false } : group
      ),
    })),
}));

export const selectGroup = (groupId) => (state) =>
  state.groups.find((group) => group.id === groupId);

export { roundContributions, roundStatus, activeMembers, currentReceiver, isPayoutReady };