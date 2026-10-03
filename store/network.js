import { create } from "zustand";

/**
 * Connectivity state for the offline-first contribution flow.
 *
 * There is no backend yet, so nothing can call NetInfo or react to a request
 * failing. Until that exists this store is driven by two things:
 *  - the browser/React Native fetch health check below, which runs on mount and
 *    on an interval so the banner still reacts to real signal loss,
 *  - a manual override so the offline UI can be demonstrated on demand.
 */
export const useNetworkStore = create((set, get) => ({
  isOnline: true,
  isChecking: false,
  override: null,

  setOnline: (isOnline) => {
    if (get().override !== null) return;
    set({ isOnline });
  },

  check: async () => {
    if (get().override !== null) return;
    set({ isChecking: true });
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4000);
      await fetch("https://www.gstatic.com/generate_204", {
        method: "HEAD",
        signal: controller.signal,
      });
      clearTimeout(timer);
      set({ isOnline: true, isChecking: false });
    } catch {
      set({ isOnline: false, isChecking: false });
    }
  },

  setOverride: (override) => set({ override, isOnline: override === null ? true : override }),
}));

export default useNetworkStore;