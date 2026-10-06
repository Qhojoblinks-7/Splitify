import React, { useEffect, useMemo, useState } from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { ThemeProvider, DarkTheme } from "expo-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { FeedbackProvider } from "../context/FeedbackContext";
import { createQueryClient, forgetPreviousMember, installApi } from "../services/query";
import { useSessionStore } from "../store/session";
import colors from "../theme/colors";

SplashScreen.preventAutoHideAsync();

const GrowlTheme = {
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
        // Pick up a stored session before the first screen renders, so a returning member is
        // not shown the login screen for a beat while we find out who they are.
        await restoreSession();
      } catch (e) {
        // A failed restore is not a failed launch. The member signs in again, which is safe.
        console.warn(e);
      } finally {
        setIsAppReady(true);
        await SplashScreen.hideAsync();
      }
    }
    prepareApp();
  }, [endSession, restoreSession]);

  // Whatever is cached belongs to whoever was signed in when it was fetched. Signing in, out,
  // or being signed out by a rejected token all mean it may now belong to someone else.
  useEffect(() => {
    forgetPreviousMember(queryClient);
  }, [isAuthenticated, queryClient]);

  if (!isAppReady) {
    return (
      <View style={styles.splashContainer}>
        <ActivityIndicator size="large" color="#fbb81c" />
      </View>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <ThemeProvider value={GrowlTheme}>
          <FeedbackProvider>
          <View style={styles.rootContainer}>
            <StatusBar style="light" translucent backgroundColor="transparent" />
            <Stack
              screenOptions={{
                headerShown: false,
                headerShadowVisible: false,
                animation: "slide_from_right",
                contentStyle: { backgroundColor: "#16171b" },
                headerStyle: { backgroundColor: "#16171b" },
                headerTintColor: "#ffffff",
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
              <Stack.Screen name="groups" />
              <Stack.Screen name="susu/create" />
              <Stack.Screen name="susu/[id]" />
              <Stack.Screen name="susu/round" />
              <Stack.Screen name="HelpSupport" />
              <Stack.Screen name="PrivacyPolicy" />
              <Stack.Screen name="AboutUs" />
              <Stack.Screen name="TermsOfService" />
            </Stack>
          </View>
          </FeedbackProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  rootContainer: { flex: 1, backgroundColor: colors.background },
  splashContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.background,
  },
});