import React, { useEffect, useState } from "react"; 
import { View, Text, ActivityIndicator, StyleSheet } from "react-native"; 
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar"; 
// 1. IMPORT THEME ROUTING MANIFEST PACKAGES
import { ThemeProvider, DarkTheme } from "expo-router";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [isAppReady, setIsAppReady] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState("Please wait!...");

  useEffect(() => {
    async function prepareApp() {
      try {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        setLoadingStatus("Almost there...");
        await new Promise((resolve) => setTimeout(resolve, 2000));
      } catch (e) {
        console.warn(e);
      } finally {
        setIsAppReady(true);
        await SplashScreen.hideAsync();
      }
    }
    prepareApp();
  }, []);

  // 2. BUILD YOUR PREMIUM CUSTOM SPLITIFY THEME SCHEME
  const SplitifyTheme = {
    ...DarkTheme,
    colors: {
      ...DarkTheme.colors,
      background: "#16171b", // This erases the native white canvas permanently!
      card: "#16171b",       // Sets native header panels to match your canvas background
    },
  };

  if (!isAppReady) {
    return (
      <View style={styles.splashContainer}>
        <ActivityIndicator size="large" color="#fbb81c" />
        <Text style={styles.loadingText}>{loadingStatus}</Text>
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      {/* 3. WRAP THE CODES DIRECTLY INSIDE THE THEME PROVIDER BLOCK */}
      <ThemeProvider value={SplitifyTheme}>
        <StatusBar style="light" translucent={true} backgroundColor="transparent" />
        
          <Stack
            screenOptions={{
              headerShown: false, 
              headerShadowVisible: false,
              // Specifying animation configurations explicitly handles smoother rendering steps
              animation: "slide_from_right", 
              contentStyle: {
                backgroundColor: "#16171b", // Extra layout paint fallback protection layer
              },
              headerStyle: {
                backgroundColor: "#16171b", 
              },
              headerTintColor: "#ffffff",
              headerTitleStyle: {
                fontWeight: "bold",
              },
            }}
          >
            <Stack.Screen name="onboarding" />
            <Stack.Screen name="Auth/index" /> 
            <Stack.Screen name="Auth/Login" /> 
            <Stack.Screen name="Auth/ForgotPassword" options={{ headerShown: true, headerBackVisible: true, headerTitle: "" }} />
            <Stack.Screen name="Auth/OTP" options={{ headerShown: true, headerBackVisible: true, headerTitle: "" }} />
            <Stack.Screen name="Auth/NewPassword" options={{ headerShown: true, headerBackVisible: true, headerTitle: "" }} />
            <Stack.Screen name="Auth/CreateAccount" options={{ headerShown: true, headerBackVisible: true, headerTitle: "" }} />
            <Stack.Screen name="HomeScreen" options={{ headerShown: false, headerBackVisible: false, headerTitle: "" }} />
          </Stack>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  splashContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#16171b", 
  },
  loadingText: {
    marginTop: 20,
    fontSize: 16,
    color: "#ffffff",
    fontWeight: "500",
  },
  globalSafeArea: {
    flex: 1,
    backgroundColor: "#16171b", 
  }
});