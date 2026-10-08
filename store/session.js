import { create } from "zustand";

import { initialsOf } from "../services/susu";
import { ApiError, setAccessToken, signIn as signInRequest, signUp as signUpRequest, socialSignIn as socialSignInRequest, updateProfile as updateProfileRequest } from "../services/auth";
import { clearTokens, loadTokens, saveTokens, savePhone, loadHasSeenOnboarding, saveHasSeenOnboarding } from "../services/tokenStorage";
import { fetchConsent, fetchNotice, giveConsent } from "../services/privacy";
import colors from "../theme/colors";

const FALLBACK_AVATAR = colors.gold;

/**
 * Record the member's consent once, against the notice the server is serving.
 *
 * The agreement itself happens where the member reads the notice: the create
 * account screen refuses to continue until the box is ticked, because Act 843
 * s.20(1) wants consent before processing, not after. The server cannot tie that
 * tick to a person until the person has a session, and the only way an account
 * comes into existence here is by signing in — so the first sign-in is where the
 * grant is recorded.
 *
 * Only a member with no consent history is granted here. A history means the
 * member has already made a choice, and a withdrawal is a row in that history
 * rather than an absence of one. A choice already made is not ours to overturn at
 * login; the member re-grants from the rights screen if they change their mind.
 *
 * The version is read from the notice the server serves, never typed here. A
 * consent recorded against a version nobody is showing is a consent recorded
 * against the wrong notice, and the version the registration application quotes
 * has to be the version this recorded.
 *
 * A failure here never fails the sign-in. The rights screen reports the consent
 * position, so a member whose grant did not land is shown it was not recorded
 * and can grant it by hand.
 */
async function recordConsentForFirstSignIn() {
  try {
    const consent = await fetchConsent();
    if (consent?.inForce || consent?.history?.length > 0) return;
    const notice = await fetchNotice();
    if (!notice?.version) return;
    await giveConsent(notice.version);
  } catch {
    // Swallowed deliberately: see the doc comment. Sign-in is the thing that
    // must not break; the rights screen is the place the gap becomes visible.
  }
}

/**
 * Who is signed in, and what the API is allowed to do on their behalf.
 *
 * No default user and no `isAuthenticated: true` on boot. A client that invents a session is a
 * client that shows one member another member's round, because every screen behind it assumes
 * `isAuthenticated` means the server said so.
 *
 * The token is kept in `expo-secure-store` rather than AsyncStorage, which is readable from a
 * backup. See `services/tokenStorage` for what happens when it is unavailable. I23.
 */
export const useSessionStore = create((set, get) => ({
  user: null,
  token: null,
  refreshToken: null,
  isAuthenticated: false,
  status: "idle", // idle | restoring | signingIn | signedIn
   storage: "unknown", // secure-store | memory | unknown
   authError: null,
   requires_profile_completion: false,

  hasSeenOnboarding: false,
  notificationsEnabled: true,

  /**
   * Pick a stored session back up at launch.
   *
   * A restored token is put in front of the API wrapper but is not yet trusted: nothing here
   * asserts the member is signed in. That waits for the first request, because a token can
   * have expired or been revoked while the app was closed, and telling someone they are signed
   * in when they are not is worse than one extra request. `status` reports the difference so a
   * screen can tell "still finding out" from "definitely signed out".
   */
  restoreSession: async () => {
    set({ status: "restoring" });

    let restored;
    try {
      restored = await loadTokens();
    } catch {
      set({ status: "idle" });
      return { ok: false };
    }

    let hasSeenOnboarding = false;
    try {
      hasSeenOnboarding = await loadHasSeenOnboarding();
    } catch {}

    if (!restored.access) {
      set({ status: "idle", hasSeenOnboarding });
      return { ok: false };
    }

    setAccessToken(restored.access);
    set({
      token: restored.access,
      refreshToken: restored.refresh,
      status: "idle",
      storage: "secure-store",
      hasSeenOnboarding,
    });
    return { ok: true, needsVerification: true };
  },

  /**
   * Sign in for real: the server decides whether these credentials are good.
   *
   * No local fallback and no default user. A client that invents a session on failure is a
   * client that shows one member another member's round.
   */
  authenticate: async ({ phone, password }) => {
    set({ status: "signingIn", authError: null });

    try {
      const session = await signInRequest({ phone, password });

      // Persist before announcing success: a member told they are signed in, then killed by
      // the OS before the write lands, comes back to a login screen with a working password
      // typed into it and no memory of having been signed in.
      await saveTokens(session).catch(() => {});

      set({
        token: session.access,
        refreshToken: session.refresh,
        user: {
          id: null, // filled in by the profile read once there is one
          name: phone,
          phone,
          initials: initialsOf(phone),
          avatarColor: FALLBACK_AVATAR,
          ghanaCardVerified: false,
        },
        isAuthenticated: true,
        status: "signedIn",
        authError: null,
      });
      await recordConsentForFirstSignIn();
      return { ok: true };
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.status === 401
            ? "That phone number and password do not match."
            : error.offline
              ? "We could not reach Growl. Check your connection and try again."
              : error.message
          : "Something went wrong signing in.";
      set({ status: "idle", authError: message, isAuthenticated: false });
      return { ok: false, message };
    }
   },

  /**
   * Register a new account.
   *
   * Mirrors `authenticate` but POSTs to the registration endpoint instead of
   * the token endpoint. The server validates the phone number and password,
   * creates the Account, and returns JWT tokens in the same shape. From the
   * client's perspective, registration and first sign-in are one call.
   */
  register: async ({ phone, email, password }) => {
    set({ status: "signingIn", authError: null });

    try {
      const session = await signUpRequest({ phone, email, password });

      await saveTokens(session).catch(() => {});
      await savePhone(phone).catch(() => {});

      set({
        token: session.access,
        refreshToken: session.refresh,
        user: {
          id: null,
          name: phone,
          phone,
          initials: initialsOf(phone),
          avatarColor: FALLBACK_AVATAR,
          ghanaCardVerified: false,
        },
        isAuthenticated: true,
        status: "signedIn",
        authError: null,
      });
      await recordConsentForFirstSignIn();
      return { ok: true };
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.status === 400
            ? error.message
            : error.status === 401
              ? "That phone number and password do not match."
              : error.offline
                ? "We could not reach Growl. Check your connection and try again."
                : error.message
          : "Something went wrong creating your account.";
      set({ status: "idle", authError: message, isAuthenticated: false });
      return { ok: false, message };
    }
  },

  /**
   * Sign in with Google or Apple.
   *
   * The frontend obtains an ID token from the provider SDK and sends it here.
   * The backend verifies it, creates or retrieves an Account, and returns JWT
   * tokens. The client stores them and records consent — the same
   * post-sign-up path `authenticate` uses.
   *
   * If the backend created a placeholder phone (social providers don't always
   * supply one), `result.requires_profile_completion` is true and the caller
   * should redirect to the CompleteProfile screen.
   */
  socialSignIn: async ({ provider, idToken, phone }) => {
    set({ status: "signingIn", authError: null });

    try {
      const session = await socialSignInRequest({ provider, idToken, phone });

      await saveTokens(session).catch(() => {});

      set({
        token: session.access,
        refreshToken: session.refresh,
        user: {
          id: null,
          name: phone || provider,
          phone: phone || null,
          initials: phone ? initialsOf(phone) : (provider === "google" ? "G" : "A"),
          avatarColor: FALLBACK_AVATAR,
          ghanaCardVerified: false,
        },
        isAuthenticated: true,
        status: "signedIn",
        authError: null,
        requires_profile_completion: session.requires_profile_completion,
      });
      await recordConsentForFirstSignIn();
      return { ok: true, requires_profile_completion: session.requires_profile_completion };
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.status === 401
            ? "That account could not be verified."
            : error.offline
              ? "We could not reach Growl. Check your connection and try again."
              : error.message
          : "Something went wrong signing in.";
      set({ status: "idle", authError: message, isAuthenticated: false });
      return { ok: false, message };
    }
  },

  /**
   * Forget the session, everywhere.
   *
   * Called on sign-out and also by the API wrapper when the server rejects the token, so an
   * expired session cannot leave a screen rendering numbers it can no longer refresh.
   */
  clearSession: () => {
    setAccessToken(null);
    clearTokens().catch(() => {});
    set({ user: null, token: null, refreshToken: null, isAuthenticated: false, status: "idle", requires_profile_completion: false });
  },

  signOut: () => get().clearSession(),

  clearAuthError: () => set({ authError: null }),

  updateProfile: async (patch) => {
    set({ status: "signingIn", authError: null });

    try {
      await updateProfileRequest(patch);

      const current = get().user;
      if (current) {
        const name = patch.full_name || patch.name || current.name;
        set({
          user: {
            ...current,
            full_name: patch.full_name || current.full_name,
            phone: patch.phone || current.phone,
            name,
            initials: initialsOf(name),
          },
          requires_profile_completion: false,
        });
      }

      set({ status: "signedIn" });
      return { ok: true };
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.offline
            ? "We could not reach Growl. Check your connection and try again."
            : error.message
          : "Something went wrong updating your profile.";
      set({ status: "idle", authError: message });
      return { ok: false, message };
    }
  },

  completeOnboarding: () => {
    set({ hasSeenOnboarding: true });
    saveHasSeenOnboarding().catch(() => {});
  },
  setNotificationsEnabled: (enabled) => set({ notificationsEnabled: enabled }),
}));

export default useSessionStore;