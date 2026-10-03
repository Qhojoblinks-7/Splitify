import { create } from "zustand";
import { initialsOf } from "../services/susu";

const DEMO_USER = {
  id: "u1",
  name: "John Doe",
  phone: "+233 244 123 567",
  email: "john@example.com",
  ghanaCardVerified: false,
};

const FALLBACK_AVATAR = "#fbb81c";

export const useSessionStore = create((set, get) => ({
  user: DEMO_USER,
  isAuthenticated: true,
  hasSeenOnboarding: false,
  notificationsEnabled: true,

  signIn: (patch = {}) => {
    const name = patch.name || DEMO_USER.name;
    set({
      user: {
        ...DEMO_USER,
        ...patch,
        id: patch.id || DEMO_USER.id,
        name,
        initials: initialsOf(name),
        avatarColor: patch.avatarColor || get().user?.avatarColor || FALLBACK_AVATAR,
      },
      isAuthenticated: true,
    });
  },

  signOut: () => set({ user: DEMO_USER, isAuthenticated: false }),

  updateProfile: (patch) => {
    const current = get().user || DEMO_USER;
    const name = patch.name || current.name;
    set({
      user: {
        ...current,
        ...patch,
        name,
        initials: initialsOf(name),
      },
    });
  },

  completeOnboarding: () => set({ hasSeenOnboarding: true }),
  setNotificationsEnabled: (enabled) => set({ notificationsEnabled: enabled }),
}));

export default useSessionStore;