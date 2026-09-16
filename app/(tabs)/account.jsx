import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, useColorScheme } from "react-native";
import { ChevronRight, QrCode, User, Shield, CreditCard, Receipt, Link, Palette, Settings, Bell, Pencil, HelpCircle, BarChart3, PiggyBank, Star, Mail, GitBranch, Apple, Globe , Smartphone, Key, UserX, MessageSquare, FileText, Info, ScrollText, MessageCircle} from "lucide-react-native";
import { useRouter } from "expo-router";
import { useTabBar } from "./_layout";
import BottomSheet from "../../components/molecule/BottomSheet";

export default function Account() {
  const systemColorScheme = useColorScheme();
  const [isSheetVisible, setSheetVisible] = useState(false);
  const [isQrVisible, setQrVisible] = useState(false);
  const [isLinkedVisible, setLinkedVisible] = useState(false);
  const [isAppearanceVisible, setAppearanceVisible] = useState(false);
  const [isPaymentVisible, setPaymentVisible] = useState(false);
  const [isFeedbackVisible, setFeedbackVisible] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [themePreference, setThemePreference] = useState(
    systemColorScheme === "dark" ? "dark" : systemColorScheme === "light" ? "light" : "system"
  );
  const { setMode, mode } = useTabBar();
  const router = useRouter();

  const openQr = () => {
    setMode("qr");
    setQrVisible(true);
  };

  const closeQr = () => {
    setMode("tabs");
    setQrVisible(false);
  };

  const submitFeedback = () => {
    if (feedbackRating === 0) {
      Alert.alert("Rate your experience", "Select a star rating before sending your feedback.");
      return;
    }

    if (!feedbackMessage.trim()) {
      Alert.alert("Missing feedback", "Tell us about your experience before sending.");
      return;
    }

    Alert.alert(
      "Thank you for your feedback",
      "Your feedback has been received and will help us improve Splitify.",
      [{ text: "Done" }]
    );
    setFeedbackRating(0);
    setFeedbackMessage("");
    setFeedbackVisible(false);
  };

  return (
    <View style={styles.container}>
      {/* PROFILE HEADER */}
      <View style={styles.profileHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>JD</Text>
        </View>
        <View style={styles.profileInfo}>
          <Text style={styles.profileName}>John Doe</Text>
          <Text style={styles.profileEmail}>john@example.com</Text>
        </View>
        <TouchableOpacity style={styles.qrBtn} onPress={openQr}>
          <QrCode size={24} color="#fbb81c" />
        </TouchableOpacity>
      </View>

      {/* SUBSCRIBE BANNER */}
      <TouchableOpacity style={styles.banner} onPress={() => router.push("/UpgradePlan")}>
        <Star size={24} color="#e8c547" style={styles.star1} />
        <Star size={16} color="#d4b03a" style={styles.star2} />
        <Star size={18} color="#f0d054" style={styles.star3} />
        <Text style={styles.bannerTitle}>Upgrade Plan to Unlock More!</Text>
        <Text style={styles.bannerSubtext}>Get access to premium features and benefits</Text>
      </TouchableOpacity>

      {/* MENU ITEMS */}
      <ScrollView>
        <TouchableOpacity style={styles.menuItem} onPress={() => setAppearanceVisible(true)}>
          <View style={styles.menuLeft}>
            <Palette size={20} color="#fbb81c" />
            <Text style={styles.menuText}>App Appearance</Text>
          </View>
          <ChevronRight size={20} color="#8e8e93" />
        </TouchableOpacity>


        <TouchableOpacity style={styles.menuItem} onPress={() => setPaymentVisible(true)}>
          <View style={styles.menuLeft}>
            <CreditCard size={20} color="#fbb81c" />
            <Text style={styles.menuText}>Payment Methods</Text>
          </View>
          <ChevronRight size={20} color="#8e8e93" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={() => router.push("/BillingSubscription")}>
          <View style={styles.menuLeft}>
            <Receipt size={20} color="#fbb81c" />
            <Text style={styles.menuText}>Bill & Subscription</Text>
          </View>
          <ChevronRight size={20} color="#8e8e93" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={() => setLinkedVisible(true)}>
          <View style={styles.menuLeft}>
            <Link size={20} color="#fbb81c" />
            <Text style={styles.menuText}>Linked Accounts</Text>
          </View>
          <ChevronRight size={20} color="#8e8e93" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={() => router.push("/Settings")}>
          <View style={styles.menuLeft}>
            <Settings size={20} color="#fbb81c" />
            <Text style={styles.menuText}>Settings</Text>
          </View>
          <ChevronRight size={20} color="#8e8e93" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={() => router.push("/screens/Notifications")}>
          <View style={styles.menuLeft}>
            <Bell size={20} color="#fbb81c" />
            <Text style={styles.menuText}>Notifications</Text>
          </View>
          <ChevronRight size={20} color="#8e8e93" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={() => router.push("/HelpSupport")}>
          <View style={styles.menuLeft}>
            <HelpCircle size={20} color="#fbb81c" />
            <Text style={styles.menuText}>Help & Support</Text>
          </View>
          <ChevronRight size={20} color="#8e8e93" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={() => router.push("/ContactSupport")}>
          <View style={styles.menuLeft}>
            <MessageCircle size={20} color="#fbb81c" />
            <Text style={styles.menuText}>Contact Support</Text>
          </View>
          <ChevronRight size={20} color="#8e8e93" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={() => setFeedbackVisible(true)}>
          <View style={styles.menuLeft}>
            <MessageSquare size={20} color="#fbb81c" />
            <Text style={styles.menuText}>Feedback</Text>
          </View>
          <ChevronRight size={20} color="#8e8e93" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={() => router.push("/PrivacyPolicy")}>
          <View style={styles.menuLeft}>
            <FileText size={20} color="#fbb81c" />
            <Text style={styles.menuText}>Privacy Policy</Text>
          </View>
          <ChevronRight size={20} color="#8e8e93" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={() => router.push("/AboutUs")}>
          <View style={styles.menuLeft}>
            <Info size={20} color="#fbb81c" />
            <Text style={styles.menuText}>About Us</Text>
          </View>
          <ChevronRight size={20} color="#8e8e93" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={() => router.push("/TermsOfService")}>
          <View style={styles.menuLeft}>
            <ScrollText size={20} color="#fbb81c" />
            <Text style={styles.menuText}>Terms of Service</Text>
          </View>
          <ChevronRight size={20} color="#8e8e93" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={() => router.push("/Analytics")}>
          <View style={styles.menuLeft}>
            <BarChart3 size={20} color="#fbb81c" />
            <Text style={styles.menuText}>Data & Analytics</Text>
          </View>
          <ChevronRight size={20} color="#8e8e93" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={() => router.push("/Savings")}>
          <View style={styles.menuLeft}>
            <PiggyBank size={20} color="#fbb81c" />
            <Text style={styles.menuText}>Savings</Text>
          </View>
          <ChevronRight size={20} color="#8e8e93" />
        </TouchableOpacity>
      </ScrollView>

      {/* BOTTOM SHEET */}
      <BottomSheet
        isVisible={isSheetVisible}
        onClose={() => setSheetVisible(false)}
        title="Personal Info"
      >
        <ScrollView contentContainerStyle={styles.sheetContent}>
          <View style={styles.sheetAvatarWrap}>
            <TouchableOpacity style={styles.sheetAvatar} onPress={() => { setSheetVisible(false); router.push("/profile"); }}>
              <Text style={styles.sheetAvatarText}>JD</Text>
              <View style={styles.editPencil}>
                <Pencil size={16} color="#16171b" />
              </View>
            </TouchableOpacity>
          </View>
          <Text style={styles.sheetName}>John Doe</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Email</Text>
            <Text style={styles.infoValue}>john@example.com</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Phone</Text>
            <Text style={styles.infoValue}>+233 244 ***567</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Date of Birth</Text>
            <Text style={styles.infoValue}>15 Jan 1995</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Gender</Text>
            <Text style={styles.infoValue}>Male</Text>
          </View>
        </ScrollView>
      </BottomSheet>

      {/* QR CODE BOTTOM SHEET */}
      <BottomSheet
        isVisible={isQrVisible}
        onClose={closeQr}
        title="Your QR Code"
      >
        <View style={styles.qrContainer}>
          <View style={styles.qrBox}>
            <QrCode size={200} color="#ffffff" />
          </View>
          <Text style={styles.qrHint}>Scan to add John Doe as a contact</Text>
          <View style={styles.qrButtons}>
            <TouchableOpacity style={styles.qrBtnAction} onPress={() => { /* TODO: save */ }}>
              <Text style={styles.qrBtnText}>Save</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.qrBtnAction} onPress={() => { /* TODO: share */ }}>
              <Text style={styles.qrBtnText}>Share</Text>
            </TouchableOpacity>
          </View>
        </View>
      </BottomSheet>

      {/* LINKED ACCOUNTS BOTTOM SHEET */}
      <BottomSheet
        isVisible={isLinkedVisible}
        onClose={() => setLinkedVisible(false)}
        title="Linked Accounts"
      >
        <ScrollView contentContainerStyle={styles.sheetContent}>
          {/* EMAIL ACCOUNTS */}
          <Text style={styles.sheetSectionTitle}>Email Accounts</Text>
          <View style={styles.accountCard}>
            <View style={[styles.accountIcon, styles.email]}>
              <Mail size={24} color="#ffffff" />
            </View>
            <View style={styles.accountInfo}>
              <Text style={styles.accountName}>Primary Email</Text>
              <Text style={styles.accountEmail}>john@example.com</Text>
            </View>
            <Text style={styles.accountStatus}>Verified</Text>
          </View>
          <View style={styles.accountCard}>
            <View style={[styles.accountIcon, styles.email]}>
              <Mail size={24} color="#ffffff" />
            </View>
            <View style={styles.accountInfo}>
              <Text style={styles.accountName}>Backup Email</Text>
              <Text style={styles.accountEmail}>john.backup@gmail.com</Text>
            </View>
            <Text style={[styles.accountStatus, styles.pending]}>Pending</Text>
          </View>
          <TouchableOpacity style={styles.addAccountBtn} onPress={() => { /* TODO: add email */ }}>
            <Text style={styles.addAccountText}>+ Add Email Account</Text>
          </TouchableOpacity>

          {/* SOCIAL ACCOUNTS */}
          <Text style={styles.sheetSectionTitle}>Social Accounts</Text>
          <View style={styles.accountCard}>
            <View style={[styles.accountIcon, styles.github]}>
              <GitBranch size={24} color="#ffffff" />
            </View>
            <View style={styles.accountInfo}>
              <Text style={styles.accountName}>GitHub</Text>
              <Text style={styles.accountEmail}>@johndoe</Text>
            </View>
            <Text style={styles.accountStatus}>Connected</Text>
          </View>
          <View style={styles.accountCard}>
            <View style={[styles.accountIcon, styles.google]}>
              <Globe size={24} color="#ffffff" />
            </View>
            <View style={styles.accountInfo}>
              <Text style={styles.accountName}>Google</Text>
              <Text style={styles.accountEmail}>john.doe@gmail.com</Text>
            </View>
            <Text style={styles.accountStatus}>Connected</Text>
          </View>
          <View style={styles.accountCard}>
            <View style={[styles.accountIcon, styles.apple]}>
              <Apple size={24} color="#ffffff" />
            </View>
            <View style={styles.accountInfo}>
              <Text style={styles.accountName}>Apple</Text>
              <Text style={styles.accountEmail}>john.doe@icloud.com</Text>
            </View>
            <Text style={[styles.accountStatus, styles.pending]}>Not Connected</Text>
          </View>
          <TouchableOpacity style={styles.addAccountBtn} onPress={() => { /* TODO: add social */ }}>
            <Text style={styles.addAccountText}>+ Connect Social Account</Text>
          </TouchableOpacity>
        </ScrollView>
      </BottomSheet>
      {/* APPEARANCE BOTTOM SHEET */}
      <BottomSheet
        isVisible={isAppearanceVisible}
        onClose={() => setAppearanceVisible(false)}
        title="App Appearance"
      >
        <ScrollView contentContainerStyle={styles.sheetContent}>
          <TouchableOpacity
            style={[
              styles.themeOption,
              themePreference === "dark" && styles.themeOptionSelected,
            ]}
            onPress={() => setThemePreference("dark")}
          >
            <View style={styles.themeOptionLeft}>
              <View style={styles.themeIconDark} />
              <View>
                <Text style={styles.themeOptionTitle}>Dark</Text>
                <Text style={styles.themeOptionDesc}>Use dark theme</Text>
              </View>
            </View>
            {themePreference === "dark" && <View style={styles.checkMark}>
              <Text style={styles.checkMarkText}>✓</Text>
            </View>}
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.themeOption,
              themePreference === "light" && styles.themeOptionSelected,
            ]}
            onPress={() => setThemePreference("light")}
          >
            <View style={styles.themeOptionLeft}>
              <View style={styles.themeIconLight} />
              <View>
                <Text style={styles.themeOptionTitle}>Light</Text>
                <Text style={styles.themeOptionDesc}>Use light theme</Text>
              </View>
            </View>
            {themePreference === "light" && <View style={styles.checkMark}>
              <Text style={styles.checkMarkText}>✓</Text>
            </View>}
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.themeOption,
              themePreference === "system" && styles.themeOptionSelected,
            ]}
            onPress={() => setThemePreference("system")}
          >
            <View style={styles.themeOptionLeft}>
              <View style={styles.themeIconSystem}>
                <View style={styles.themeIconHalfTop} />
                <View style={styles.themeIconHalfBottom} />
              </View>
              <View>
                <Text style={styles.themeOptionTitle}>System</Text>
                <Text style={styles.themeOptionDesc}>Match device setting</Text>
              </View>
            </View>
            {themePreference === "system" && <View style={styles.checkMark}>
              <Text style={styles.checkMarkText}>✓</Text>
            </View>}
          </TouchableOpacity>
        </ScrollView>
      </BottomSheet>

      {/* PAYMENT METHODS BOTTOM SHEET */}
      <BottomSheet
        isVisible={isPaymentVisible}
        onClose={() => setPaymentVisible(false)}
        title="Payment Methods"
      >
        <ScrollView contentContainerStyle={styles.sheetContent}>
          <TouchableOpacity style={styles.addAccountBtn}>
            <Text style={styles.addAccountText}>+ Add Payment Method</Text>
          </TouchableOpacity>
        </ScrollView>
      </BottomSheet>

      <BottomSheet
        isVisible={isFeedbackVisible}
        onClose={() => setFeedbackVisible(false)}
        title="Share Feedback"
      >
        <ScrollView contentContainerStyle={styles.feedbackContent} showsVerticalScrollIndicator={false}>
          <Text style={styles.feedbackPrompt}>How was your Splitify experience?</Text>

          <View style={styles.ratingRow}>
            {[1, 2, 3, 4, 5].map((rating) => (
              <TouchableOpacity
                key={rating}
                style={styles.ratingButton}
                onPress={() => setFeedbackRating(rating)}
                accessibilityRole="button"
                accessibilityLabel={`Rate ${rating} out of 5`}
              >
                <Star
                  size={32}
                  color="#fbb81c"
                  fill={rating <= feedbackRating ? "#fbb81c" : "transparent"}
                />
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.ratingLabel}>
            {feedbackRating > 0 ? `${feedbackRating} out of 5` : "Tap a star to rate"}
          </Text>

          <TextInput
            style={styles.feedbackInput}
            value={feedbackMessage}
            onChangeText={setFeedbackMessage}
            placeholder="Tell us what went well or what we can improve"
            placeholderTextColor="#8e8e93"
            multiline
            textAlignVertical="top"
            accessibilityLabel="Feedback message"
          />

          <TouchableOpacity
            style={styles.feedbackSubmit}
            onPress={submitFeedback}
            accessibilityRole="button"
            accessibilityLabel="Send feedback"
          >
            <Text style={styles.feedbackSubmitText}>Send Feedback</Text>
          </TouchableOpacity>
        </ScrollView>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#16171b" },
  banner: {
    margin: 20,
    padding: 20,
    backgroundColor: "#fbb81c",
    borderRadius: 16,
    alignItems: "center",
    overflow: "hidden",
  },
  star1: { position: "absolute", top: 10, left: 15 },
  star2: { position: "absolute", top: 30, right: 20 },
  star3: { position: "absolute", bottom: 15, left: 30 },
  bannerTitle: { color: "#16171b", fontSize: 16, fontWeight: "bold", textAlign: "center" },
  bannerSubtext: { color: "#16171b", fontSize: 12, marginTop: 6, textAlign: "center" },
  profileHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#2a2b30",
  },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: "#fbb81c", justifyContent: "center", alignItems: "center" },
  avatarText: { color: "#16171b", fontSize: 24, fontWeight: "bold" },
  profileInfo: { flex: 1, marginLeft: 16 },
  profileName: { color: "#ffffff", fontSize: 18, fontWeight: "bold" },
  profileEmail: { color: "#8e8e93", fontSize: 14, marginTop: 2 },
  qrBtn: { padding: 8 },
  menuItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#2a2b30",
  },
  menuLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  menuText: { color: "#ffffff", fontSize: 16 },
  // Sheet styles
  sheetContent: { paddingVertical: 20 },
  sheetAvatarWrap: { alignItems: "center", marginBottom: 8 },
  sheetAvatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: "#fbb81c", justifyContent: "center", alignItems: "center" },
  sheetAvatarText: { color: "#16171b", fontSize: 28, fontWeight: "bold" },
  editPencil: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#fbb81c",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#16171b",
  },
  sheetName: { color: "#ffffff", fontSize: 20, fontWeight: "bold", marginBottom: 20, textAlign: "center", alignSelf: "center" },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  infoLabel: { color: "#8e8e93", fontSize: 14 },
  infoValue: { color: "#ffffff", fontSize: 14, textAlign: "right" },
  qrContainer: { alignItems: "center", paddingVertical: 40 },
  qrBox: { padding: 20, backgroundColor: "#ffffff", borderRadius: 16 },
  qrHint: { color: "#8e8e93", fontSize: 14, marginTop: 16, textAlign: "center" },
  qrButtons: { flexDirection: "row", marginTop: 24, marginHorizontal: 60, justifyContent: "space-between" },
  qrBtnAction: { flex: 1, marginHorizontal: 6, backgroundColor: "#fbb81c", borderRadius: 16, padding: 14, alignItems: "center" },
  qrBtnText: { color: "#16171b", fontSize: 16, fontWeight: "bold" },
  // Linked Accounts Sheet styles
  sheetSectionTitle: { color: "#fbb81c", fontSize: 14, fontWeight: "bold", marginTop: 20, marginBottom: 12, marginHorizontal: 20 },
  accountCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#2a2b30",
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 8,
  },
  accountIcon: { width: 44, height: 44, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  email: { backgroundColor: "#ea4335" },
  github: { backgroundColor: "#24292e" },
  google: { backgroundColor: "#4285f4" },
  apple: { backgroundColor: "#000000" },
  accountInfo: { flex: 1 },
  accountName: { color: "#ffffff", fontSize: 16, fontWeight: "600" },
  accountEmail: { color: "#8e8e93", fontSize: 13, marginTop: 2 },
  accountStatus: { color: "#4ade80", fontSize: 12, fontWeight: "600" },
  pending: { color: "#fbb81c" },
  addAccountBtn: {
    marginHorizontal: 20,
    marginTop: 8,
    marginBottom: 20,
    padding: 16,
    backgroundColor: "#2a2b30",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#fbb81c",
    borderStyle: "dashed",
    alignItems: "center",
  },
  addAccountText: { color: "#fbb81c", fontSize: 15, fontWeight: "600" },
  // Theme Option Styles
  themeOption: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#2a2b30",
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "transparent",
  },
  themeOptionSelected: {
    borderColor: "#fbb81c",
  },
  themeOptionLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  themeIconDark: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#2a2b30",
    borderWidth: 2,
    borderColor: "#8e8e93",
  },
  themeIconLight: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#fbb81c",
    borderWidth: 2,
    borderColor: "#fbb81c",
  },
  themeIconSystem: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "#8e8e93",
  },
  themeIconHalfTop: {
    flex: 1,
    backgroundColor: "#fbb81c",
  },
  themeIconHalfBottom: {
    flex: 1,
    backgroundColor: "#2a2b30",
  },
  themeOptionTitle: { color: "#ffffff", fontSize: 16, fontWeight: "600" },
  themeOptionDesc: { color: "#8e8e93", fontSize: 13, marginTop: 2 },
  checkMark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#fbb81c",
    justifyContent: "center",
    alignItems: "center",
  },
  checkMarkText: { color: "#16171b", fontSize: 14, fontWeight: "bold" },
  feedbackContent: {
    paddingVertical: 20,
    paddingHorizontal: 20,
    gap: 14,
  },
  feedbackPrompt: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "bold",
    textAlign: "center",
  },
  ratingRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 6,
  },
  ratingButton: {
    padding: 4,
  },
  ratingLabel: {
    color: "#fbb81c",
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 6,
  },
  feedbackInput: {
    minHeight: 130,
    backgroundColor: "#2a2b30",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#ffffff",
    fontSize: 15,
  },
  feedbackSubmit: {
    minHeight: 52,
    marginTop: 6,
    borderRadius: 14,
    backgroundColor: "#fbb81c",
    alignItems: "center",
    justifyContent: "center",
  },
  feedbackSubmitText: {
    color: "#16171b",
    fontSize: 16,
    fontWeight: "bold",
  },
});