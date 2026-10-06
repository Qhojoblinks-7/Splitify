# Security

Ntuboa is a fintech app that records group savings contributions and payment
history. A compromised device means a compromised ledger. This document describes
the client-side protections and where to find them.

## Session management

### Where tokens live

Tokens are stored in `expo-secure-store` (iOS keychain / Android encrypted
SharedPreferences), never in `AsyncStorage`. SecureStore is backed by the OS
keychain, so a token at rest is not recoverable from a normal device backup.

**File:** `services/tokenStorage.js`

```
SecureStore (preferred) → in-memory Map (fallback)
```

On devices where SecureStore is unavailable (Expo Go, or a native module that
throws on load), the token falls back to an in-memory `Map`. A cold start on
such a device loses the session, forcing a re-sign-in — inconvenient, and the
safe failure mode.

**Why not `AsyncStorage`?** A refresh token recovered from a plaintext backup
is a session recovered by whoever made the backup.

### When sessions end

A session ends in exactly three situations:

| Trigger          | Where                                    | What happens                                   |
|------------------|------------------------------------------|------------------------------------------------|
| Sign out         | `app/(tabs)/account.jsx`, `app/Security.jsx` | `signOut()` → `clearSession()` → tokens wiped from secure-store and API wrapper |
| 401 from server  | `services/api.js:166-168`                | `onUnauthorized()` → `endSession()` → same as sign-out |
| Token refresh fail | `services/auth.js` (future)            | Planned: refresh token exchanged for a new access token; if the server rejects the refresh, session is cleared |

## Auth guard

**File:** `app/_layout.jsx`

The root layout guards every route. After the session restore completes:

```
!hasSeenOnboarding  → Redirect to /onboarding
!token              → Redirect to /Auth/Login
isLocked && token   → Render <AppLockScreen>
otherwise           → Render the <Stack> (tabs, auth flows, etc.)
```

A token restored from secure-store is sufficient to enter the app — the first
API call verifies it. If the server rejects the token (401), `onUnauthorized`
fires and the session is cleared, which re-triggers the redirect to login.

## Idle timeout and app lock

### How it works

1. When the app enters the background, `AppState` fires and
   `useSecurityStore.touch()` records the current timestamp.
2. When the app returns to the foreground, the layout compares the elapsed time
   against `IDLE_TIMEOUT_MS` (5 minutes by default).
3. If the threshold is exceeded **and** the member has opted in to app lock,
   `lock()` sets `isLocked: true`, and `<AppLockScreen>` is rendered in place
   of the tab navigator.

**Timeout:** `IDLE_TIMEOUT_MS = 5 * 60 * 1000` (5 minutes) — see
`store/security.js`.

**File:** `app/_layout.jsx` (AppState listener), `components/molecule/AppLockScreen.jsx`
(re-auth UI), `store/security.js` (state).

### Biometric re-auth

When app lock is enabled and the device supports biometrics (Face ID, Touch ID,
or Android biometric):

- `expo-local-authentication` checks `hasHardwareAsync()` and `isEnrolledAsync()`.
- On the lock screen, `authenticateAsync()` is called with
  `promptMessage: "Unlock Ntuboa"`.
- The device, not the app, performs the biometric matching. The module returns
  only a boolean — no fingerprint, face data, or PIN is ever read by Ntuboa.
- If biometrics are unavailable or rejected, a fallback button lets the member
  sign in with their phone number.

**No fallback to device PIN:** `disableDeviceFallback` is `false`, so the OS
offers its own PIN/fallback flow when biometrics fail. This is handled entirely
by the OS — it never reaches the app.

### Settings

Members control these options from **Security** (accessible via the Account
screen menu):

- **App lock** — on/off. When off, inactivity does not trigger a lock screen;
  the session simply expires via the server's token lifetime.
- **Biometric unlock** — on/off. Only visible when app lock is on and the device
  supports biometrics. Disabling this means phone-number sign-in is the only
  unlock path.

## What is not yet implemented

| Feature                              | Status  | Notes                                              |
|--------------------------------------|---------|----------------------------------------------------|
| Forced PIN after N failed biometrics | Planned | Currently falls back to OS PIN or sign-in           |
| Session timeout shorter than server token lifetime | N/A | Server-side token expiry governs overall session lifetime |
| Remote sign-out (all devices)        | Planned | `app/Security.jsx` shows a placeholder for this     |
| In-app PIN creation                  | Planned | Currently relies on biometrics or phone-number auth |

## Files

| File                                  | Responsibility                                    |
|---------------------------------------|---------------------------------------------------|
| `store/security.js`                   | Zustand store: lock state, app-lock toggle, persistence |
| `app/_layout.jsx`                     | AppState listener, auth guard, lock-screen gate   |
| `components/molecule/AppLockScreen.jsx` | Biometric/PIN unlock UI                          |
| `app/Security.jsx`                    | Member-facing settings screen                     |
| `app/(tabs)/account.jsx`              | Menu entry linking to Security screen             |
| `__tests__/security.test.js`          | Unit tests for store state transitions            |
