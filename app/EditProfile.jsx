import React, { useState } from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Phone, User } from "lucide-react-native";
import BaseButton from "../components/atoms/BaseButton";
import CustomInput from "../components/atoms/CustomInput";
import AuthScreenLayout from "../components/molecule/AuthScreenLayout";
import { useSessionStore } from "../store/session";
import colors from "../theme/colors";

export default function EditProfile() {
  const router = useRouter();
  const user = useSessionStore((s) => s.user);
  const updateProfile = useSessionStore((s) => s.updateProfile);
  const status = useSessionStore((s) => s.status);
  const authError = useSessionStore((s) => s.authError);
  const clearAuthError = useSessionStore((s) => s.clearAuthError);

  const [fullName, setFullName] = useState(user?.full_name || user?.name || "");
  const [phone, setPhone] = useState(user?.phone || "");

  const busy = status === "signingIn";
  const canSubmit = fullName.trim().length > 0 && phone.trim().length > 0 && !busy;

  const onPressSave = async () => {
    if (!canSubmit) return;
    clearAuthError();

    const result = await updateProfile({
      full_name: fullName.trim(),
      phone: phone.trim(),
    });

    if (result.ok) {
      router.back();
    }
  };

  return (
    <AuthScreenLayout
      title="Edit Profile"
      footer={
        <BaseButton
          title={busy ? "Saving..." : "Save changes"}
          onPress={onPressSave}
          fullWidth
          variant="primary"
          disabled={!canSubmit}
          isLoading={busy}
        />
      }
    >
      <Text style={styles.subtitle}>
        Update your name and mobile money number.
      </Text>

      <CustomInput
        label="Full name"
        autoCapitalize="words"
        placeholder="Jane Mensah"
        placeholderTextColor={colors.inactive}
        borderColor={colors.inactive}
        iconLeft={<User color={colors.inactive} size={20} />}
        style={styles.input}
        value={fullName}
        onChangeText={(text) => {
          clearAuthError();
          setFullName(text);
        }}
      />

      <CustomInput
        label="Mobile money number"
        keyboardType="phone-pad"
        autoCapitalize="none"
        placeholder="+233 20 000 0000"
        placeholderTextColor={colors.inactive}
        borderColor={colors.inactive}
        iconLeft={<Phone color={colors.inactive} size={20} />}
        style={styles.input}
        value={phone}
        onChangeText={(text) => {
          clearAuthError();
          setPhone(text);
        }}
      />

      {authError ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{authError}</Text>
        </View>
      ) : null}

      {busy ? <ActivityIndicator color={colors.gold} style={styles.spinner} /> : null}
    </AuthScreenLayout>
  );
}

const styles = StyleSheet.create({
  input: {
    width: "100%",
    marginBottom: 16,
  },
  subtitle: {
    color: colors.textBody,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 24,
    textAlign: "center",
  },
  errorBox: {
    width: "100%",
    backgroundColor: colors.dangerSoftAlt,
    borderRadius: 10,
    borderLeftWidth: 3,
    borderLeftColor: colors.danger,
    padding: 12,
    marginBottom: 12,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    lineHeight: 18,
  },
  spinner: {
    marginBottom: 12,
  },
});
