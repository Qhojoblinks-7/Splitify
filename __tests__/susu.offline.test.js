/**
 * @jest-environment node
 */
const { useSusuStore } = require("../store/susu");
const { useQueueStore } = require("../store/queue");
const { useNetworkStore } = require("../store/network");

const seedGroup = () => ({
  id: "g1",
  name: "Market Susu",
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
  createdBy: "u1",
  adminTrustScore: 100,
  flaggedTotal: 0,
  inviteCode: "MK7QW2",
  members: [
    { id: "u1", name: "You", phone: "0244000000", role: "admin", order: 0, active: true, missedStreak: 0, missedShare: 0 },
    { id: "u2", name: "Ama", phone: "0244000001", role: "member", order: 1, active: true, missedStreak: 0, missedShare: 0 },
  ],
  contributions: [],
  payouts: [],
});

const reset = () => {
  useSusuStore.setState({ groups: [seedGroup()], userId: "u1" });
  useQueueStore.setState({ items: [] });
  useNetworkStore.setState({ isOnline: true, override: null });
};

const contribution = () => useSusuStore.getState().groups[0].contributions[0];

beforeEach(reset);

describe("offline contribution queue", () => {
  it("records a contribution as queued when there is no signal", () => {
    useNetworkStore.setState({ isOnline: false });

    useQueueStore.getState().enqueue({
      groupId: "g1",
      payload: { amount: "100", provider: "mtn_momo", reference: "MP260114.0932" },
    });

    const entry = contribution();
    expect(entry.status).toBe("pending");
    expect(entry.syncState).toBe("offline");
    expect(entry.reference).toBe("MP260114.0932");
  });

  it("never records an offline contribution as verified", () => {
    useNetworkStore.setState({ isOnline: false });

    useQueueStore.getState().enqueue({
      groupId: "g1",
      payload: { amount: "100", provider: "mtn_momo", reference: "MP260114.0932" },
    });

    expect(contribution().status).not.toBe("verified");
  });

  it("keeps a stable idempotency key per queued item", () => {
    useNetworkStore.setState({ isOnline: false });

    const item = useQueueStore.getState().enqueue({
      groupId: "g1",
      payload: { amount: "100", provider: "mtn_momo", reference: "MP1.1111" },
    });

    expect(item.id).toMatch(/^q-/);
    expect(useQueueStore.getState().items).toHaveLength(1);
    expect(contribution().queueId).toBe(item.id);
  });

  it("preserves queue order so contributions replay in the order they were made", () => {
    useNetworkStore.setState({ isOnline: false });

    const first = useQueueStore.getState().enqueue({
      groupId: "g1",
      payload: { amount: "100", provider: "mtn_momo", reference: "MP1.0001" },
    });
    const second = useQueueStore.getState().enqueue({
      groupId: "g1",
      payload: { amount: "50", provider: "mtn_momo", reference: "MP1.0002" },
    });

    const ordered = [...useQueueStore.getState().items].sort((a, b) => a.queuedAt - b.queuedAt);
    expect(ordered.map((i) => i.id)).toEqual([first.id, second.id]);
  });

  it("marks the matching contribution as queued once an item syncs", () => {
    useNetworkStore.setState({ isOnline: false });

    const item = useQueueStore.getState().enqueue({
      groupId: "g1",
      payload: { amount: "100", provider: "mtn_momo", reference: "MP1.2222" },
    });

    useQueueStore.getState().markSynced(item.id);

    expect(contribution().syncState).toBe("queued");
    expect(useQueueStore.getState().items).toHaveLength(0);
  });

  it("does not silently discard an item after repeated failures", () => {
    useNetworkStore.setState({ isOnline: false });

    const item = useQueueStore.getState().enqueue({
      groupId: "g1",
      payload: { amount: "100", provider: "mtn_momo", reference: "MP1.3333" },
    });

    for (let attempt = 0; attempt < 7; attempt += 1) {
      useQueueStore.getState().markFailed(item.id, "no network");
    }

    expect(useQueueStore.getState().items).toHaveLength(1);
    expect(useQueueStore.getState().items[0].reason).toBe("no network");
  });

  it("drains nothing while offline", () => {
    useNetworkStore.setState({ isOnline: false });
    useQueueStore.getState().enqueue({
      groupId: "g1",
      payload: { amount: "100", provider: "mtn_momo", reference: "MP1.4444" },
    });

    useQueueStore.getState().drain();

    expect(useQueueStore.getState().items).toHaveLength(1);
    expect(contribution().syncState).toBe("offline");
  });
});

describe("loading state", () => {
  it("resolves and clears the error flag", async () => {
    const ok = await useSusuStore.getState().loadGroups();
    expect(ok).toBe(true);
    expect(useSusuStore.getState().isLoading).toBe(false);
    expect(useSusuStore.getState().loadError).toBeNull();
  });

  it("surfaces a message when the load fails", async () => {
    const ok = await useSusuStore.getState().loadGroups({ fail: true });
    expect(ok).toBe(false);
    expect(useSusuStore.getState().isLoading).toBe(false);
    expect(useSusuStore.getState().loadError).toMatch(/could not load/i);
  });
});