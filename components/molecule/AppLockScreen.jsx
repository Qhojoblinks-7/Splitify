/**
 * In-app lock screen.
 *
 * Shown when the member returns to the app after the idle timeout has elapsed.
 * Uses `expo-local-authentication` for biometric/PIN when the member has opted
 * in to app lock; the device, not the app, decides whether to fall back to the
 * system PIN. No biometric data is ever read by the app — the module returns
 * only a boolean.
 */

import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from "react-native";
import { Lock, LogIn, AlertCircle } from "lucide-react-native";
import * as LocalAuthentication from "expo-local-authentication";
import colors from "../../theme/colors";

export default function AppLockScreen({ onUnlock }) {
  const [checking, setChecking] = useState(true);
  const [canUseBiometrics, setCanUseBiometrics] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    checkAndAuthenticate();
  }, []);

  async function checkAndAuthenticate() {
    setChecking(false);
    setError("");

    try {
      const hardware = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      setCanUseBiometrics(hardware && enrolled);

      if (hardware && enrolled) {
        authenticate();
      }
    } catch (err) {
      setError("Biometrics are not available on this device.");
    }
  }

  async function authenticate() {
    setChecking(true);
    setError("");
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Unlock Ntuboa",
        disableDeviceFallback: false,
        fallbackTitle: "Enter PIN",
      });
      if (result.success) {
        onUnlock();
      } else {
        setError("Authentication failed. Try again or sign in.");
      }
    } catch (err) {
      setError("Authentication is not available.");
    } finally {
      setChecking(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>
        <Lock size={48} color={colors.gold} />
      </View>
      <Text style={styles.title}>Screen locked</Text>
      <Text style={styles.sub}>
        Ntuboa locked after 5 minutes of inactivity. Unlock with biometrics
        to see your groups.
      </Text>

      {error ? (
        <View style={styles.errorRow}>
          <AlertCircle size={14} color={colors.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {canUseBiometrics ? (
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={authenticate}
          disabled={checking}
          accessibilityRole="button"
          accessibilityLabel="Unlock with biometrics"
        >
          {checking ? (
            <ActivityIndicator color={colors.background} />
          ) : (
            <Text style={styles.primaryBtnText}>Unlock with biometrics</Text>
          )}
        </TouchableOpacity>
      ) : null}

      <TouchableOpacity
        style={styles.secondaryBtn}
        onPress={() => {
          if (typeof onUnlock === "function") {
            onUnlock();
          }
        }}
        accessibilityRole="button"
        accessibilityLabel="Use phone number to sign in"
      >
        <LogIn size={16} color={colors.gold} />
        <Text style={styles.secondaryBtnText}>Use phone number instead</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  iconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.goldSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 28,
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 8,
  },
  sub: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
    marginBottom: 24,
  },
  errorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 16,
  },
  errorText: {
    color: colors.danger,
    fontSize: 12,
  },
  primaryBtn: {
    minWidth: 200,
    height: 52,
    borderRadius: 14,
    backgroundColor: colors.gold,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  primaryBtnText: {
    color: colors.background,
    fontSize: 15,
    fontWeight: "700",
  },
  secondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  secondaryBtnText: {
    color: colors.gold,
    fontSize: 14,
    fontWeight: "700",
  },
});
