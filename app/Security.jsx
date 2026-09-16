import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from "react-native";
import { ChevronLeft, Lock, Fingerprint, Smartphone, Shield, UserX, Trash2, AlertCircle, Key, ToggleLeft, ToggleRight, Bell, MessageSquare, ChevronRight} from "lucide-react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import BottomSheet from "../components/molecule/BottomSheet";

export default function Security() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [isChangePasswordVisible, setChangePasswordVisible] = useState(false);
  const [isDeactivateVisible, setDeactivateVisible] = useState(false);
  const [isDeleteVisible, setDeleteVisible] = useState(false);

  const toggles = [
    { id: "rememberMe", label: "Remember Me", icon: Lock, description: "Stay logged in on this device", defaultOn: true },
    { id: "biometric", label: "Biometric ID", icon: Fingerprint, description: "Use fingerprint to unlock", defaultOn: true },
    { id: "faceId", label: "Face ID", icon: Smartphone, description: "Use facial recognition to unlock", defaultOn: false },
    { id: "smsAuth", label: "SMS Authentication", icon: MessageSquare, description: "Receive login codes via SMS", defaultOn: true },
    { id: "googleAuth", label: "Google Authenticator", icon: Shield, description: "Use 2FA with Google Authenticator", defaultOn: false },
  ];

  const [toggleStates, setToggleStates] = useState(() => {
    const initial = {};
    toggles.forEach((t) => { initial[t.id] = t.defaultOn; });
    return initial;
  });

  const handleToggle = (id) => {
    setToggleStates((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Back Button */}
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ChevronLeft size={28} color="#ffffff" />
        </TouchableOpacity>

        {/* Header */}
        <View style={styles.header}>
          <Lock size={32} color="#fbb81c" />
          <Text style={styles.title}>Account & Security</Text>
          <Text style={styles.subtitle}>Manage your security settings</Text>
        </View>

        {/* Authentication Methods */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Authentication Methods</Text>
          {toggles.map((item) => (
            <View key={item.id} style={styles.toggleItem}>
              <View style={styles.toggleLeft}>
                <View style={styles.toggleIcon}>
                  <item.icon size={20} color="#fbb81c" />
                </View>
                <View>
                  <Text style={styles.toggleLabel}>{item.label}</Text>
                  <Text style={styles.toggleDescription}>{item.description}</Text>
                </View>
              </View>
              <TouchableOpacity
                style={[
                  styles.toggleTrack,
                  toggleStates[item.id] && styles.toggleTrackOn,
                ]}
                onPress={() => handleToggle(item.id)}
              >
                <View
                  style={[
                    styles.toggleThumb,
                    toggleStates[item.id] && styles.toggleThumbOn,
                  ]}
                />
              </TouchableOpacity>
            </View>
          ))}
        </View>

        {/* Change Password */}
        <TouchableOpacity style={styles.menuItem} onPress={() => setChangePasswordVisible(true)}>
          <View style={styles.menuLeft}>
            <Key size={20} color="#fbb81c" />
            <Text style={styles.menuText}>Change Password</Text>
          </View>
          <ChevronRight size={20} color="#8e8e93" />
        </TouchableOpacity>

        {/* Device Management */}
        <TouchableOpacity style={styles.menuItem} onPress={() => router.push("/DeviceManagement")}>
          <View style={styles.menuLeft}>
            <Smartphone size={20} color="#fbb81c" />
            <View>
              <Text style={styles.menuText}>Device Management</Text>
              <Text style={styles.menuSubtext}>Manage your account on the devices you own</Text>
            </View>
          </View>
          <ChevronRight size={20} color="#8e8e93" />
        </TouchableOpacity>

        {/* Deactivate Account */}
        <TouchableOpacity style={[styles.menuItem, styles.destructiveItem]} onPress={() => setDeactivateVisible(true)}>
          <View style={styles.menuLeft}>
            <UserX size={20} color="#ff6b6b" />
            <View>
              <Text style={styles.menuTextDestructive}>Deactivate Account</Text>
              <Text style={styles.menuSubtext}>Temporarily deactivate your account. Easily reactivate when you are ready</Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* Delete Account */}
        <TouchableOpacity style={[styles.menuItem, styles.destructiveItem]} onPress={() => setDeleteVisible(true)}>
          <View style={styles.menuLeft}>
            <Trash2 size={20} color="#ff6b6b" />
            <View>
              <Text style={styles.menuTextDestructive}>Delete Account</Text>
              <Text style={styles.menuSubtext}>Permanently delete your account and all data</Text>
            </View>
          </View>
        </TouchableOpacity>
      </ScrollView>

      {/* CHANGE PASSWORD BOTTOM SHEET */}
      <BottomSheet
        isVisible={isChangePasswordVisible}
        onClose={() => setChangePasswordVisible(false)}
        title="Change Password"
      >
        <View style={styles.sheetContent}>
          <Text style={styles.sheetSubtitle}>Enter your current and new password</Text>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Current Password</Text>
            <TextInput style={styles.input} placeholder="Current password" secureTextEntry />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>New Password</Text>
            <TextInput style={styles.input} placeholder="New password" secureTextEntry />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Confirm New Password</Text>
            <TextInput style={styles.input} placeholder="Confirm new password" secureTextEntry />
          </View>
          <TouchableOpacity style={styles.sheetBtnPrimary} onPress={() => setChangePasswordVisible(false)}>
            <Text style={styles.sheetBtnText}>Update Password</Text>
          </TouchableOpacity>
        </View>
      </BottomSheet>

      {/* DEACTIVATE ACCOUNT BOTTOM SHEET */}
      <BottomSheet
        isVisible={isDeactivateVisible}
        onClose={() => setDeactivateVisible(false)}
        title="Deactivate Account"
      >
        <View style={styles.sheetContent}>
          <AlertCircle size={48} color="#ff6b6b" style={styles.alertIcon} />
          <Text style={styles.sheetTitle}>Deactivate Account</Text>
          <Text style={styles.sheetSubtitle}>Your account will be temporarily disabled. You can reactivate anytime by logging in.</Text>
          <View style={styles.warningBox}>
            <Text style={styles.warningText}>• Your profile will be hidden from others</Text>
            <Text style={styles.warningText}>• Your data will be preserved</Text>
            <Text style={styles.warningText}>• You can reactivate by signing in</Text>
          </View>
          <TouchableOpacity style={styles.sheetBtnDestructive} onPress={() => { setDeactivateVisible(false); }}>
            <Text style={styles.sheetBtnText}>Deactivate Account</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.sheetBtnCancel} onPress={() => setDeactivateVisible(false)}>
            <Text style={styles.sheetBtnCancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </BottomSheet>

      {/* DELETE ACCOUNT BOTTOM SHEET */}
      <BottomSheet
        isVisible={isDeleteVisible}
        onClose={() => setDeleteVisible(false)}
        title="Delete Account"
      >
        <View style={styles.sheetContent}>
          <AlertCircle size={48} color="#ff6b6b" style={styles.alertIcon} />
          <Text style={styles.sheetTitle}>Delete Account Permanently</Text>
          <Text style={styles.sheetSubtitle}>This action cannot be undone. All your data will be permanently deleted.</Text>
          <View style={styles.warningBox}>
            <Text style={styles.warningText}>• All groups, expenses, and history will be lost</Text>
            <Text style={styles.warningText}>• Your account cannot be recovered</Text>
            <Text style={styles.warningText}>• This action is irreversible</Text>
          </View>
          <View style={styles.confirmInputGroup}>
            <Text style={styles.inputLabel}>Type "DELETE" to confirm</Text>
            <TextInput style={styles.input} placeholder="DELETE" />
          </View>
          <TouchableOpacity style={styles.sheetBtnDestructive} onPress={() => { setDeleteVisible(false); }}>
            <Text style={styles.sheetBtnText}>Delete Account</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.sheetBtnCancel} onPress={() => setDeleteVisible(false)}>
            <Text style={styles.sheetBtnCancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#16171b" },
  scrollContent: { padding: 20, paddingBottom: 40 },
  backBtn: { padding: 4, marginBottom: 20 },
  header: { alignItems: "center", marginBottom: 30 },
  title: { color: "#ffffff", fontSize: 28, fontWeight: "bold", marginTop: 12 },
  subtitle: { color: "#8e8e93", fontSize: 16, marginTop: 4 },
  section: { marginBottom: 24 },
  sectionTitle: { color: "#ffffff", fontSize: 18, fontWeight: "bold", marginBottom: 16 },
  toggleItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#2a2b30",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  toggleLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  toggleIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: "#fbb81c", justifyContent: "center", alignItems: "center" },
  toggleLabel: { color: "#ffffff", fontSize: 16, fontWeight: "600" },
  toggleDescription: { color: "#8e8e93", fontSize: 13, marginTop: 2 },
  toggleTrack: { width: 52, height: 28, borderRadius: 14, backgroundColor: "#3a3b40", justifyContent: "center", paddingHorizontal: 2 },
  toggleTrackOn: { backgroundColor: "#fbb81c" },
  toggleThumb: { width: 24, height: 24, borderRadius: 12, backgroundColor: "#ffffff", shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 2, elevation: 2 },
  toggleThumbOn: { marginLeft: 24 },
  menuItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#2a2b30",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  destructiveItem: { borderWidth: 1, borderColor: "#ff6b6b" },
  menuLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  menuText: { color: "#ffffff", fontSize: 16, fontWeight: "600" },
  menuTextDestructive: { color: "#ff6b6b", fontSize: 16, fontWeight: "600" },
  menuSubtext: { color: "#8e8e93", fontSize: 13, marginTop: 2 },
  // Sheet styles
  sheetContent: { paddingVertical: 10, gap: 16 },
  sheetSubtitle: { color: "#8e8e93", fontSize: 14, textAlign: "center", marginBottom: 8 },
  inputGroup: { gap: 8 },
  inputLabel: { color: "#8e8e93", fontSize: 14 },
  input: { backgroundColor: "#2a2b30", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 14, color: "#ffffff", fontSize: 16 },
  sheetBtnPrimary: { backgroundColor: "#fbb81c", borderRadius: 16, padding: 16, alignItems: "center", marginTop: 8 },
  sheetBtnText: { color: "#16171b", fontSize: 16, fontWeight: "bold" },
  alertIcon: { alignSelf: "center", marginBottom: 12 },
  sheetTitle: { color: "#ffffff", fontSize: 20, fontWeight: "bold", textAlign: "center", marginBottom: 8 },
  warningBox: { backgroundColor: "#2a2b30", borderRadius: 12, padding: 16, marginVertical: 8 },
  warningText: { color: "#ff6b6b", fontSize: 14, marginBottom: 4 },
  confirmInputGroup: { marginTop: 8, gap: 8 },
  sheetBtnDestructive: { backgroundColor: "#ff6b6b", borderRadius: 16, padding: 16, alignItems: "center", marginTop: 8 },
  sheetBtnCancel: { backgroundColor: "transparent", borderRadius: 16, padding: 16, alignItems: "center", marginTop: 8, borderWidth: 1, borderColor: "#3a3b40" },
  sheetBtnCancelText: { color: "#ffffff", fontSize: 16, fontWeight: "bold" },
});