import React from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, Alert } from "react-native";
import { ChevronLeft, ScrollText, ShieldCheck, CreditCard, AlertTriangle, RefreshCw, LogOut, Mail } from "lucide-react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const sections = [
  {
    id: "acceptance",
    title: "Acceptance Of Terms",
    icon: ScrollText,
    text: "By creating an account or using Splitify, you agree to these Terms of Service. If you do not agree, do not use the app.",
  },
  {
    id: "account",
    title: "Account Responsibilities",
    icon: ShieldCheck,
    text: "You are responsible for keeping your account information accurate and protecting your login credentials. Tell support if you believe your account has been accessed without permission.",
  },
  {
    id: "payments",
    title: "Payments And Bills",
    icon: CreditCard,
    text: "You are responsible for the bills, requests, and payment details you add to Splitify. Payment availability and processing times may depend on your payment provider.",
  },
  {
    id: "conduct",
    title: "Acceptable Use",
    icon: AlertTriangle,
    text: "Do not use Splitify for unlawful activity, fraudulent requests, harassment, or anything that could harm other users or the service.",
  },
  {
    id: "changes",
    title: "Changes To These Terms",
    icon: RefreshCw,
    text: "We may update these terms as the service changes. We will provide notice when appropriate, and continued use after an update means you accept the revised terms.",
  },
  {
    id: "termination",
    title: "Account Termination",
    icon: LogOut,
    text: "We may suspend or terminate access when necessary to protect the service, users, or comply with legal requirements. You may stop using Splitify at any time.",
  },
];

export default function TermsOfService() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const openEmail = () => {
    Linking.openURL("mailto:support@splitify.com").catch(() => {
      Alert.alert("Unable to open email", "Please open your email app manually.");
    });
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <ChevronLeft size={28} color="#ffffff" />
        </TouchableOpacity>

        <View style={styles.header}>
          <View style={styles.headerIcon}>
            <ScrollText size={30} color="#16171b" />
          </View>
          <Text style={styles.title}>Terms of Service</Text>
        </View>

        <View style={styles.introCard}>
          <Text style={styles.introTitle}>Please read carefully</Text>
          <Text style={styles.introText}>
            These terms describe your relationship with Splitify and explain how the service
            may be used.
          </Text>
        </View>

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

        <TouchableOpacity
          style={styles.contactButton}
          onPress={openEmail}
          accessibilityRole="button"
          accessibilityLabel="Contact support about terms"
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
