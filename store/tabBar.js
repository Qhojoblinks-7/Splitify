import { create } from "zustand";

export const useTabBarStore = create((set) => ({
  mode: "tabs",
  customButtons: [],
  setMode: (mode) => set({ mode }),
  setCustomButtons: (customButtons) => set({ customButtons }),
}));
