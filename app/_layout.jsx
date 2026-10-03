import React, { useEffect, useState } from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { ThemeProvider, DarkTheme } from "expo-router";
import { FeedbackProvider } from "../context/FeedbackContext";
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

  useEffect(() => {
    async function prepareApp() {
      try {
        await new Promise((resolve) => setTimeout(resolve, 1200));
      } catch (e) {
        console.warn(e);
      } finally {
        setIsAppReady(true);
        await SplashScreen.hideAsync();
      }
    }
    prepareApp();
  }, []);

  if (!isAppReady) {
    return (
      <View style={styles.splashContainer}>
        <ActivityIndicator size="large" color="#fbb81c" />
      </View>
    );
  }

  return (
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
            <Stack.Screen name="susu/create" />
            <Stack.Screen name="susu/[id]" />
            <Stack.Screen name="HelpSupport" />
            <Stack.Screen name="PrivacyPolicy" />
            <Stack.Screen name="AboutUs" />
            <Stack.Screen name="TermsOfService" />
          </Stack>
        </View>
        </FeedbackProvider>
      </ThemeProvider>
    </SafeAreaProvider>
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