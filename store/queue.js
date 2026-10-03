import { create } from "zustand";
import { useNetworkStore } from "./network";
import { useSusuStore } from "./susu";

const MAX_ATTEMPTS = 5;

/**
 * Contributions recorded while offline.
 *
 * Every item carries a client-generated idempotency key so a replay can never
 * create a second contribution. Nothing is sent yet — the drain below only
 * marks entries synced once a server exists, so the ledger stays honest in the
 * meantime instead of pretending a payment was verified.
 */
export const useQueueStore = create((set, get) => ({
  items: [],

  enqueue: ({ groupId, payload }) => {
    const item = {
      id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      groupId,
      payload,
      attempts: 0,
      queuedAt: Date.now(),
      state: "queued",
    };
    set((state) => ({ items: [...state.items, item] }));
    useSusuStore.getState().logContribution(groupId, { ...payload, syncState: "offline", queueId: item.id });
    return item;
  },

  markSyncing: (id) =>
    set((state) => ({
      items: state.items.map((i) => (i.id === id ? { ...i, state: "syncing" } : i)),
    })),

  markSynced: (id) => {
    const item = get().items.find((i) => i.id === id);
    set((state) => ({ items: state.items.filter((i) => i.id !== id) }));
    if (item) {
      useSusuStore
        .getState()
        .markContributionSynced(item.groupId, item.payload.reference, "queued");
    }
  },

  markFailed: (id, reason) =>
    set((state) => ({
      items: state.items.map((i) =>
        i.id === id ? { ...i, state: "failed", attempts: i.attempts + 1, reason } : i
      ),
    })),

  discard: (id) =>
    set((state) => ({ items: state.items.filter((i) => i.id !== id) })),

  clear: () => set({ items: [] }),

  pendingFor: (groupId) => get().items.filter((i) => i.groupId === groupId),

  /**
   * Replays the queue oldest-first when connectivity returns.
   *
   * With no backend configured this drains nothing on purpose: the honest
   * outcome is that the contribution stays visible and unverified rather than
   * being marked synced against a server that does not exist.
   */
  drain: () => {
    const { items } = get();
    const ordered = [...items].sort((a, b) => a.queuedAt - b.queuedAt);
    if (!ordered.length) return;
    if (!useNetworkStore.getState().isOnline) return;

    for (const item of ordered) {
      if (item.attempts >= MAX_ATTEMPTS) continue;
      if (item.state === "syncing") continue;
    }
  },
}));

export default useQueueStore;