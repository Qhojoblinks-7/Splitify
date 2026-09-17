import React from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, Alert } from "react-native";
import { ChevronLeft, Shield, FileText, Database, Share2, Cookie, Clock, UserCheck, Lock, RefreshCw, Mail } from "lucide-react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const contactEmail = "privacy@splitify.com";

const sections = [
  {
    id: "introduction",
    title: "Introduction",
    icon: Shield,
    text: "Splitify (Splitify Technologies Inc.) respects your privacy and is committed to protecting the personal information you share with us. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our application and services.",
  },
  {
    id: "collection",
    title: "Information We Collect",
    icon: Database,
    text: "We collect information you provide directly to us, such as when you create an account, add friends, create or join groups, record expenses, or contact us. This may include your name, email address, phone number, profile photo, and payment information. We also collect information automatically, including your device type, operating system, and usage data.",
  },
  {
    id: "use",
    title: "How We Use Your Information",
    icon: FileText,
    text: "We use the information we collect to provide, maintain, and improve our services, to personalize your experience, to communicate with you, to process transactions, and to keep our app safe and secure. We do not sell your personal information to third parties.",
  },
  {
    id: "sharing",
    title: "Data Sharing & Disclosure",
    icon: Share2,
    text: "We may share your information with service providers who assist us in operating our app and conducting our business, and when required by law or to protect our rights and safety. Any third parties we share your data with are contractually obligated to protect your information.",
  },
  {
    id: "cookies",
    title: "Cookies & Tracking",
    icon: Cookie,
    text: "We may use cookies and similar tracking technologies to enhance your experience and understand how our app is used. You can instruct your device to refuse cookies, but this may limit your ability to use certain features of the app.",
  },
  {
    id: "retention",
    title: "Data Retention",
    icon: Clock,
    text: "We retain personal information for as long as necessary to provide our services and fulfill the purposes described in this Privacy Policy, or as required by law. When information is no longer needed, we take reasonable steps to delete it.",
  },
  {
    id: "rights",
    title: "Your Rights",
    icon: UserCheck,
    text: "Depending on your location, you may have rights to access, correct, delete, or port your personal information, and to object to or restrict certain processing. You may update your profile and notification settings at any time through the app.",
  },
  {
    id: "security",
    title: "Security",
    icon: Lock,
    text: "We take the security of your information seriously and use administrative, technical, and physical safeguards designed to protect your data. However, no method of transmission over the internet or electronic storage is completely secure.",
  },
  {
    id: "changes",
    title: "Changes To This Privacy Policy",
    icon: RefreshCw,
    text: "We may update this Privacy Policy from time to time. Any changes will be posted on this page with an updated effective date. We encourage you to review this Privacy Policy whenever you use the app.",
  },
];

export default function PrivacyPolicy() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const openEmail = () => {
    Linking.openURL(`mailto:${contactEmail}`).catch(() => {
      Alert.alert("Unable to open email", "Please open your email app manually.");
    });
  };

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
            <Shield size={30} color="#16171b" />
          </View>
          <Text style={styles.title}>Privacy Policy</Text>
        </View>

        {/* Intro Card */}
        <View style={styles.introCard}>
          <Text style={styles.introTitle}>Please read carefully</Text>
          <Text style={styles.introText}>
            This policy explains what information Splitify collects, how we use it, and your rights. It applies to all users of the app.
          </Text>
        </View>

        {/* Policy Sections */}
        <View style={styles.sectionsList}>
          {sections.map((section) => {
            const Icon = section.icon;

            return (
              <View key={section.id} style={styles.sectionCard}>
                <View style={styles.sectionIcon}>
                  <Icon size={22} color="#16171b" />
                </View>
                <View style={styles.sectionCopy}>
                  <Text style={styles.sectionTitle}>{section.title}</Text>
                  <Text style={styles.sectionText}>{section.text}</Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* Contact Support */}
        <TouchableOpacity
          style={styles.contactButton}
          onPress={openEmail}
          accessibilityRole="button"
          accessibilityLabel="Contact support about privacy"
        >
          <Mail size={18} color="#16171b" />
          <Text style={styles.contactButtonText}>Contact support</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#16171b",
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 48,
  },
  backButton: {
    padding: 4,
    marginBottom: 20,
  },
  header: {
    alignItems: "center",
    marginBottom: 28,
  },
  headerIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#fbb81c",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 14,
  },
  title: {
    color: "#ffffff",
    fontSize: 28,
    fontWeight: "bold",
  },
  introCard: {
    backgroundColor: "#2a2b30",
    borderRadius: 16,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#fbb81c",
  },
  introTitle: {
    color: "#fbb81c",
    fontSize: 13,
    fontWeight: "bold",
    textTransform: "uppercase",
  },
  introText: {
    color: "#ffffff",
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8,
  },
  sectionsList: {
    gap: 12,
  },
  sectionCard: {
    flexDirection: "row",
    gap: 14,
    backgroundColor: "#2a2b30",
    borderRadius: 16,
    padding: 16,
  },
  sectionIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#fbb81c",
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  sectionCopy: {
    flex: 1,
  },
  sectionTitle: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 6,
  },
  sectionText: {
    color: "#8e8e93",
    fontSize: 14,
    lineHeight: 21,
  },
  contactButton: {
    minHeight: 52,
    marginTop: 22,
    borderRadius: 14,
    backgroundColor: "#fbb81c",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  contactButtonText: {
    color: "#16171b",
    fontSize: 15,
    fontWeight: "bold",
  },
});
