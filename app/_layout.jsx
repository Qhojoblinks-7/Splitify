import React, { useEffect, useMemo, useState } from "react";
import { View, StyleSheet, AppState } from "react-native";
import { Stack, Redirect } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { ThemeProvider, DarkTheme } from "expo-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { FeedbackProvider } from "../context/FeedbackContext";
import { createQueryClient, forgetPreviousMember, installApi } from "../services/query";
import { useSessionStore } from "../store/session";
import { useSecurityStore, IDLE_TIMEOUT_MS } from "../store/security";
import AppLockScreen from "../components/molecule/AppLockScreen";
import SplashScreenView from "../components/molecule/SplashScreen";
import colors from "../theme/colors";

SplashScreen.preventAutoHideAsync();

const NtuboaTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.background,
    card: colors.background,
  },
};

export default function RootLayout() {
  const [isAppReady, setIsAppReady] = useState(false);

  // One client for the app's whole life. Recreating it on a render would throw away the
  // cache and every screen would refetch, so it is built once and held in a ref.
  const queryClient = useMemo(() => createQueryClient(), []);
  const clearSession = useSessionStore((s) => s.clearSession);
  const restoreSession = useSessionStore((s) => s.restoreSession);
  const isAuthenticated = useSessionStore((s) => s.isAuthenticated);
  const hasSeenOnboarding = useSessionStore((s) => s.hasSeenOnboarding);
  const token = useSessionStore((s) => s.token);

  const {
    isLocked,
    appLockEnabled,
    lastActiveAt,
    lock,
    unlock,
    touch,
    hydrate,
  } = useSecurityStore();

  // A rejected token ends the session here rather than only in the store, so the cache goes with
  // it. Leaving the two out of step would leave one member's groups cached under a key the next
  // member reads.
  const endSession = useMemo(
    () => () => {
      forgetPreviousMember(queryClient);
      clearSession();
    },
    [queryClient, clearSession]
  );

  useEffect(() => {
    // Point the API wrapper at this build's server and give it a way to read the token and a
    // way to be told the token stopped working. Configured once, before any screen can issue
    // a request, because a request made before this runs would go out without an auth header.
    installApi({
      baseUrl: process.env.EXPO_PUBLIC_API_URL || "http://127.0.0.1:8000",
      onUnauthorized: endSession,
    });

    async function prepareApp() {
      try {
        // Restore persisted security settings (app lock toggle, biometrics preference)
        await hydrate();

        // Pick up a stored session before the first screen renders, so a returning member is
        // not shown the login screen for a beat while we find out who they are.
        await restoreSession();
} catch (e) {
        // A failed restore is not a failed launch. The member signs in again, which is safe.
        console.warn(e);
      } finally {
        // Hold the splash a beat past app readiness so the first screen mounts before the
        // native splash tears down. Without it the transition is a hard cut.
        await new Promise((r) => setTimeout(r, 800));
        setIsAppReady(true);
        await SplashScreen.hideAsync();
      }
    }
    prepareApp();
  }, [endSession, restoreSession, hydrate]);

  // --- Idle timeout -----------------------------------------------------------
  // When the app returns to the foreground after being backgrounded for longer
  // than IDLE_TIMEOUT_MS, lock the screen. The member re-authenticates via
  // biometrics or phone number on AppLockScreen.
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (next) => {
      if (next === "background") {
        touch();
      } else if (next === "active") {
        if (appLockEnabled && lastActiveAt) {
          const elapsed = Date.now() - lastActiveAt;
          if (elapsed >= IDLE_TIMEOUT_MS) {
            lock();
          }
        }
      }
    });
    return () => subscription.remove();
  }, [appLockEnabled, lastActiveAt, lock, touch]);

  // Whatever is cached belongs to whoever was signed in when it was fetched. Signing in, out,
  // or being signed out by a rejected token all mean it may now belong to someone else.
  useEffect(() => {
    forgetPreviousMember(queryClient);
  }, [isAuthenticated, queryClient]);

  if (!isAppReady) {
    return <SplashScreenView />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <ThemeProvider value={NtuboaTheme}>
          <FeedbackProvider>
          <View style={styles.rootContainer}>
            <StatusBar style="light" translucent backgroundColor="transparent" />

            {/* Auth guard: a token restored from secure-store is enough to show the app —
                the first API call verifies it. No token means the session was cleared
                (sign-out, 401, or cold start with nothing stored). */}
{!hasSeenOnboarding && <Redirect href="/onboarding" />}
            {hasSeenOnboarding && !token && <Redirect href="/Auth/Login" />}

            {/* App lock: shown instead of the tab navigator when the idle timeout fires
                and the member has opted in to app lock. */}
            {isLocked && token ? (
              <AppLockScreen onUnlock={unlock} />
            ) : (
              <Stack
                screenOptions={{
                  headerShown: false,
                  headerShadowVisible: false,
                  animation: "slide_from_right",
                  contentStyle: { backgroundColor: colors.background },
                  headerStyle: { backgroundColor: colors.background },
                  headerTintColor: colors.text,
                  headerTitleStyle: { fontWeight: "bold" },
                }}
              >
                <Stack.Screen name="onboarding" />
                <Stack.Screen name="Auth/Auth" />
                <Stack.Screen name="Auth/Login" />
                <Stack.Screen
                  name="Auth/ForgotPassword"
                  options={{ headerShown: true, headerBackVisible: true, headerTitle: "" }}
                />
                <Stack.Screen
                  name="Auth/OTP"
                  options={{ headerShown: true, headerBackVisible: true, headerTitle: "" }}
                />
                <Stack.Screen
                  name="Auth/NewPassword"
                  options={{ headerShown: true, headerBackVisible: true, headerTitle: "" }}
                />
                <Stack.Screen name="Auth/CreateAccount" />
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen name="susu/create" />
                <Stack.Screen name="susu/round" />
                <Stack.Screen name="HelpSupport" />
                <Stack.Screen name="PrivacyPolicy" />
                <Stack.Screen name="PrivacyRights" />
                <Stack.Screen name="AboutUs" />
                <Stack.Screen name="TermsOfService" />
                 <Stack.Screen name="Security" />
                 <Stack.Screen name="CompleteProfile" />
                 <Stack.Screen name="EditProfile" />
               </Stack>
            )}
          </View>
          </FeedbackProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  rootContainer: { flex: 1, backgroundColor: colors.background },
});