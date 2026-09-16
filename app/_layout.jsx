import React, { useEffect, useState } from "react";
import { View, Text, ActivityIndicator, StyleSheet, TouchableOpacity } from "react-native";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar"; 
// 1. IMPORT THEME ROUTING MANIFEST PACKAGES
import { ThemeProvider, DarkTheme } from "expo-router";
import { useTabBarStore } from "../store/tabBar";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { mode, customButtons } = useTabBarStore();
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
        <View style={styles.rootContainer}>
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
            <Stack.Screen name="Auth/Auth" /> 
            <Stack.Screen name="Auth/Login" /> 
            <Stack.Screen name="Auth/ForgotPassword" options={{ headerShown: true, headerBackVisible: true, headerTitle: "" }} />
            <Stack.Screen name="Auth/OTP" options={{ headerShown: true, headerBackVisible: true, headerTitle: "" }} />
            <Stack.Screen name="Auth/NewPassword" options={{ headerShown: true, headerBackVisible: true, headerTitle: "" }} />
            <Stack.Screen name="Auth/CreateAccount" options={{ headerShown: true, headerBackVisible: true, headerTitle: "" }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="screens/Notifications" options={
              {headerShown: false, headerBackVisible: true,
                headerTitle: "Notifications" 
              }
            }
            />
            <Stack.Screen name="HelpSupport" options={{ headerShown: false }} />
            <Stack.Screen name="ContactSupport" options={{ headerShown: false }} />
            <Stack.Screen name="PrivacyPolicy" options={{ headerShown: false }} />
            <Stack.Screen name="AboutUs" options={{ headerShown: false }} />
            <Stack.Screen name="TermsOfService" options={{ headerShown: false }} />
            <Stack.Screen name="SendMoney" options={{ headerShown: false }} />
            <Stack.Screen name="RequestMoney" options={{ headerShown: false }} />
            <Stack.Screen name="TopUp" options={{ headerShown: false }} />
            <Stack.Screen name="Withdraw" options={{ headerShown: false }} />
            <Stack.Screen name="History" options={{ headerShown: false }} />
          </Stack>

          {mode === "custom" && customButtons.length > 0 && (
            <View style={styles.customActionBar}>
              {customButtons.map((btn, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={[
                    styles.customActionButton,
                    btn.variant === "cancel" && styles.customActionCancel,
                    btn.variant === "primary" && styles.customActionPrimary,
                  ]}
                  onPress={btn.onPress}
                >
                  <Text
                    style={[
                      styles.customActionText,
                      btn.variant === "cancel" && styles.customActionCancelText,
                      btn.variant === "primary" && styles.customActionPrimaryText,
                    ]}
                  >
                    {btn.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    position: "relative",
    backgroundColor: "#16171b",
  },
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
  },
  customActionBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
    backgroundColor: "#16171b",
    borderTopWidth: 1,
    borderTopColor: "#2a2b30",
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    zIndex: 1000,
  },
  customActionButton: {
    flex: 1,
    marginHorizontal: 20,
    borderRadius: 16,
    paddingVertical: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  customActionCancel: {
    backgroundColor: "#2a2b30",
    borderWidth: 1,
    borderColor: "#3a3b40",
  },
  customActionPrimary: {
    backgroundColor: "#fbb81c",
  },
  customActionText: {
    color: "#16171b",
    fontSize: 14,
    fontWeight: "bold",
  },
  customActionCancelText: {
    color: "#ffffff",
  },
  customActionPrimaryText: {
    color: "#16171b",
  },
});