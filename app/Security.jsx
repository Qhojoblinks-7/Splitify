import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch } from "react-native";
import { ChevronLeft, Shield, Smartphone, Clock, Lock, CircleAlert, LogOut } from "lucide-react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as LocalAuthentication from "expo-local-authentication";
import { useSessionStore } from "../store/session";
import { useSecurityStore, IDLE_TIMEOUT_MS } from "../store/security";
import { toast } from "../utils/alert";
import colors from "../theme/colors";

export default function Security() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const signOut = useSessionStore((s) => s.signOut);
  const {
    appLockEnabled,
    biometricsEnabled,
    setAppLockEnabled,
    setBiometricsEnabled,
  } = useSecurityStore();

  const [biometricsAvailable, setBiometricsAvailable] = useState(false);

  useEffect(() => {
    checkBiometrics();
  }, []);

  async function checkBiometrics() {
    const hardware = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    setBiometricsAvailable(hardware && enrolled);
  }

  const onToggleAppLock = async (enabled) => {
    await setAppLockEnabled(enabled);
    toast.success(
      enabled
        ? `Ntuboa will lock after ${Math.round(IDLE_TIMEOUT_MS / 60000)} minutes of inactivity.`
        : "App lock turned off. You will stay signed in on this device."
    );
  };

  const onToggleBiometrics = async (enabled) => {
    await setBiometricsEnabled(enabled);
    toast.success(
      enabled
        ? "Biometrics enabled for unlocking Ntuboa."
        : "Biometrics disabled. Your phone number will be required to unlock."
    );
  };

  const onSignOutAll = () => {
    toast.info("Signing out of all devices is not yet connected. This signs out of this device only.");
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <ChevronLeft size={24} color={colors.textMuted} />
        </TouchableOpacity>

        <Text style={styles.title}>Security</Text>
        <Text style={styles.subtitle}>
          How Ntuboa protects your account when the screen is locked or the app is idle.
        </Text>

        <View style={styles.cardGroup}>
          <View style={styles.card}>
            <View style={styles.cardHead}>
              <Shield size={20} color={colors.gold} />
              <Text style={styles.cardTitle}>App lock</Text>
            </View>
            <Text style={styles.cardText}>
              After {Math.round(IDLE_TIMEOUT_MS / 60000)} minutes of inactivity, Ntuboa locks and
              requires your biometrics or phone number to open again.
            </Text>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>
                {appLockEnabled ? "On" : "Off"}
              </Text>
              <Switch
                value={appLockEnabled}
                onValueChange={onToggleAppLock}
                trackColor={{ false: colors.borderSubtle, true: colors.goldSoft }}
                thumbColor={appLockEnabled ? colors.gold : colors.placeholder}
                ios_backgroundColor={colors.borderSubtle}
              />
            </View>
          </View>

          {appLockEnabled && biometricsAvailable ? (
            <View style={styles.card}>
              <View style={styles.cardHead}>
                <Smartphone size={20} color={colors.gold} />
                <Text style={styles.cardTitle}>Biometric unlock</Text>
              </View>
              <Text style={styles.cardText}>
                When app lock fires, use Face ID or Touch ID instead of your phone number.
                No biometric data is read by Ntuboa — the device handles it.
              </Text>
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>
                  {biometricsEnabled ? "On" : "Off"}
                </Text>
                <Switch
                  value={biometricsEnabled}
                  onValueChange={onToggleBiometrics}
                  trackColor={{ false: colors.borderSubtle, true: colors.goldSoft }}
                  thumbColor={biometricsEnabled ? colors.gold : colors.placeholder}
                  ios_backgroundColor={colors.borderSubtle}
                />
              </View>
            </View>
          ) : null}

          {appLockEnabled && !biometricsAvailable ? (
            <View style={styles.card}>
              <View style={styles.cardHead}>
                <CircleAlert size={20} color={colors.textMuted} />
                <Text style={styles.cardTitle}>Biometrics unavailable</Text>
              </View>
              <Text style={styles.cardText}>
                This device does not support biometric unlock. You will be asked for your phone
                number when app lock fires.
              </Text>
            </View>
          ) : null}

          <View style={styles.infoRow}>
            <Clock size={16} color={colors.textMuted} />
            <Text style={styles.infoText}>
              Lock timeout: {Math.round(IDLE_TIMEOUT_MS / 60000)} minutes
            </Text>
          </View>
        </View>

        <View style={styles.cardGroup}>
          <View style={styles.card}>
            <View style={styles.cardHead}>
              <LogOut size={20} color={colors.danger} />
              <Text style={[styles.cardTitle, { color: colors.danger }]}>Sign out</Text>
            </View>
            <TouchableOpacity
              style={styles.dangerBtn}
              onPress={() => {
                signOut();
                router.replace("/Auth/Login");
              }}
              accessibilityRole="button"
              accessibilityLabel="Sign out of your account"
            >
              <Text style={styles.dangerBtnText}>Sign out</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  body: { paddingHorizontal: 20, paddingBottom: 48 },
  backButton: { padding: 4, marginBottom: 24, alignSelf: "flex-start" },
  title: { color: colors.text, fontSize: 28, fontWeight: "700", letterSpacing: -0.3 },
  subtitle: { color: colors.textBody, fontSize: 14, lineHeight: 21, marginTop: 6, marginBottom: 24 },
  cardGroup: { gap: 14, marginBottom: 8 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: 18,
  },
  cardHead: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: "600" },
  cardText: { color: colors.textBody, fontSize: 13, lineHeight: 20, marginBottom: 14 },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.borderSubtle,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  switchLabel: { color: colors.textBodyAlt, fontSize: 13, fontWeight: "700" },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  infoText: { color: colors.textMuted, fontSize: 12 },
  dangerBtn: {
    backgroundColor: colors.dangerSoftAlt,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 4,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  dangerBtnText: { color: colors.danger, fontSize: 15, fontWeight: "700" },
});
