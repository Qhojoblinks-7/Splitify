import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { ChevronLeft, ChevronRight, Check, Settings, Palette, Bell, Mail, Globe, HelpCircle, FileText, Shield } from "lucide-react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import BottomSheet from "../components/molecule/BottomSheet";

export default function AppSettings() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [toggles, setToggles] = useState({
    darkMode: true,
    pushNotifications: true,
    emailNotifications: false,
  });

  const [languageSheetVisible, setLanguageSheetVisible] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState("English");

  const languages = ["English", "Español", "Français", "Deutsch", "Português", "简体中文"];

  const handleToggle = (id) => {
    setToggles((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const navigateTo = (route) => {
    router.push(route);
  };

  const navItems = [
    { id: "helpSupport", label: "Help & Support", icon: HelpCircle, route: "/HelpSupport" },
    { id: "terms", label: "Terms of Service", icon: FileText, route: "/TermsOfService" },
    { id: "privacy", label: "Privacy Policy", icon: Shield, route: "/PrivacyPolicy" },
  ];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Back Button */}
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <ChevronLeft size={28} color="#ffffff" />
        </TouchableOpacity>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerIcon}>
            <Settings size={30} color="#16171b" />
          </View>
          <Text style={styles.title}>Settings</Text>
          <Text style={styles.subtitle}>Customize your Splitify experience</Text>
        </View>

        {/* Preferences Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preferences</Text>

          {/* Dark Mode */}
          <View style={styles.toggleItem}>
            <View style={styles.toggleLeft}>
              <View style={styles.toggleIcon}>
                <Palette size={20} color="#fbb81c" />
              </View>
              <View>
                <Text style={styles.toggleLabel}>Dark Mode</Text>
                <Text style={styles.toggleDescription}>Use dark theme throughout the app</Text>
              </View>
            </View>
            <TouchableOpacity
              style={[
                styles.toggleTrack,
                toggles.darkMode && styles.toggleTrackOn,
              ]}
              onPress={() => handleToggle("darkMode")}
              accessibilityRole="switch"
              accessibilityLabel="Toggle dark mode"
            >
              <View
                style={[
                  styles.toggleThumb,
                  toggles.darkMode && styles.toggleThumbOn,
                ]}
              />
            </TouchableOpacity>
          </View>

          {/* Push Notifications */}
          <View style={styles.toggleItem}>
            <View style={styles.toggleLeft}>
              <View style={styles.toggleIcon}>
                <Bell size={20} color="#fbb81c" />
              </View>
              <View>
                <Text style={styles.toggleLabel}>Push Notifications</Text>
                <Text style={styles.toggleDescription}>Receive push notifications</Text>
              </View>
            </View>
            <TouchableOpacity
              style={[
                styles.toggleTrack,
                toggles.pushNotifications && styles.toggleTrackOn,
              ]}
              onPress={() => handleToggle("pushNotifications")}
              accessibilityRole="switch"
              accessibilityLabel="Toggle push notifications"
            >
              <View
                style={[
                  styles.toggleThumb,
                  toggles.pushNotifications && styles.toggleThumbOn,
                ]}
              />
            </TouchableOpacity>
          </View>

          {/* Email Notifications */}
          <View style={styles.toggleItem}>
            <View style={styles.toggleLeft}>
              <View style={styles.toggleIcon}>
                <Mail size={20} color="#fbb81c" />
              </View>
              <View>
                <Text style={styles.toggleLabel}>Email Notifications</Text>
                <Text style={styles.toggleDescription}>Receive billing updates via email</Text>
              </View>
            </View>
            <TouchableOpacity
              style={[
                styles.toggleTrack,
                toggles.emailNotifications && styles.toggleTrackOn,
              ]}
              onPress={() => handleToggle("emailNotifications")}
              accessibilityRole="switch"
              accessibilityLabel="Toggle email notifications"
            >
              <View
                style={[
                  styles.toggleThumb,
                  toggles.emailNotifications && styles.toggleThumbOn,
                ]}
              />
            </TouchableOpacity>
          </View>

          {/* Language */}
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => setLanguageSheetVisible(true)}
            accessibilityRole="button"
            accessibilityLabel="Language"
          >
            <View style={styles.menuLeft}>
              <View style={styles.toggleIcon}>
                <Globe size={20} color="#fbb81c" />
              </View>
              <View>
                <Text style={styles.menuText}>Language</Text>
                <Text style={styles.menuSubtext}>{selectedLanguage}</Text>
              </View>
            </View>
            <ChevronRight size={20} color="#8e8e93" />
          </TouchableOpacity>
        </View>

        {/* Support Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Support</Text>
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <TouchableOpacity
                key={item.id}
                style={styles.menuItem}
                onPress={() => navigateTo(item.route)}
                accessibilityRole="button"
                accessibilityLabel={item.label}
              >
                <View style={styles.menuLeft}>
                  <View style={styles.toggleIcon}>
                    <Icon size={20} color="#fbb81c" />
                  </View>
                  <Text style={styles.menuText}>{item.label}</Text>
                </View>
                <ChevronRight size={20} color="#8e8e93" />
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.versionText}>Splitify v1.0.0 (342)</Text>
          <TouchableOpacity
            style={styles.logoutBtn}
            onPress={() => router.push("/Auth/Auth")}
            accessibilityRole="button"
            accessibilityLabel="Log out"
          >
            <Text style={styles.logoutText}>Log Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Language Picker Bottom Sheet */}
      <BottomSheet
        isVisible={languageSheetVisible}
        onClose={() => setLanguageSheetVisible(false)}
        title="Select Language"
      >
        <View style={styles.sheetContent}>
          {languages.map((lang) => (
            <TouchableOpacity
              key={lang}
              style={styles.langItem}
              onPress={() => {
                setSelectedLanguage(lang);
                setLanguageSheetVisible(false);
              }}
            >
              <Text
                style={[
                  styles.langText,
                  selectedLanguage === lang && styles.langItemSelected,
                ]}
              >
                {lang}
              </Text>
              {selectedLanguage === lang && <Check size={18} color="#fbb81c" />}
            </TouchableOpacity>
          ))}
        </View>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#16171b" },
  scrollContent: { padding: 20, paddingBottom: 40 },
  backButton: { padding: 4, marginBottom: 20 },
  header: { alignItems: "center", marginBottom: 28 },
  headerIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#fbb81c",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 14,
  },
  title: { color: "#ffffff", fontSize: 28, fontWeight: "bold" },
  subtitle: { color: "#8e8e93", fontSize: 15, marginTop: 5, textAlign: "center", lineHeight: 21 },
  section: { marginBottom: 28 },
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
  toggleIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "#fbb81c",
    justifyContent: "center",
    alignItems: "center",
  },
  toggleLabel: { color: "#ffffff", fontSize: 16, fontWeight: "600" },
  toggleDescription: { color: "#8e8e93", fontSize: 13, marginTop: 2 },
  toggleTrack: {
    width: 52,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#3a3b40",
    justifyContent: "center",
    paddingHorizontal: 2,
  },
  toggleTrackOn: { backgroundColor: "#fbb81c" },
  toggleThumb: { width: 24, height: 24, borderRadius: 12, backgroundColor: "#ffffff" },
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
  menuLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  menuText: { color: "#ffffff", fontSize: 16, fontWeight: "600" },
  menuSubtext: { color: "#8e8e93", fontSize: 13, marginTop: 2 },
  sheetContent: { paddingVertical: 10, gap: 8 },
  langItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 4,
  },
  langText: { color: "#8e8e93", fontSize: 16 },
  langItemSelected: { color: "#ffffff", fontWeight: "600" },
  footer: {
    marginTop: 8,
    alignItems: "center",
    gap: 16,
  },
  versionText: { color: "#8e8e93", fontSize: 13 },
  logoutBtn: {
    backgroundColor: "#2a2b30",
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderWidth: 1,
    borderColor: "#ff6b6b",
  },
  logoutText: { color: "#ff6b6b", fontSize: 16, fontWeight: "bold" },
});
