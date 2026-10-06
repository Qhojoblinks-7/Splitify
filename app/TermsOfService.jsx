import React from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { ChevronLeft, Mail } from "lucide-react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { openEmail } from "../utils/openEmail";
import colors from "../theme/colors";

const supportEmail = "support@ntuboa.app";

const sections = [
  {
    id: "acceptance",
    title: "Acceptance of Terms",
    text: "By creating an account or using Ntuboa, you agree to these Terms of Service. If you do not agree, do not use the app.",
  },
  {
    id: "account",
    title: "Account Responsibilities",
    text: "You are responsible for keeping your account information accurate and protecting your login credentials. Tell support if you believe your account has been accessed without permission.",
  },
  {
    id: "payments",
    title: "Contributions and Payouts",
    text: "Contributions are recorded against the mobile money reference you provide. A pot is only released once every contribution for that round is verified, and amounts and processing times depend on your mobile money provider.",
  },
  {
    id: "conduct",
    title: "Acceptable Use",
    text: "Do not use Ntuboa for unlawful activity, fraudulent requests, harassment, or anything that could harm other users or the service.",
  },
  {
    id: "changes",
    title: "Changes to These Terms",
    text: "We may update these terms as the service changes. We will provide notice when appropriate, and continued use after an update means you accept the revised terms.",
  },
  {
    id: "termination",
    title: "Account Termination",
    text: "We may suspend or terminate access when necessary to protect the service, users, or comply with legal requirements. You may stop using Ntuboa at any time.",
  },
];

export default function TermsOfService() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const openSupportEmail = () => openEmail(supportEmail);

  return (
    <View style={[styles.paper, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={styles.document} showsVerticalScrollIndicator={false}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <ChevronLeft size={24} color={colors.textMuted} />
        </TouchableOpacity>

        <View style={styles.header}>
          <Text style={styles.title}>Terms of Service</Text>
          <Text style={styles.version}>Version 1.0</Text>
          <View style={styles.rule} />
        </View>

        <Text style={styles.lead}>
          These terms describe your relationship with Ntuboa and explain how the service may be used.
        </Text>

        <View style={styles.sectionsList}>
          {sections.map((section, index) => (
            <View key={section.id} style={styles.section}>
              <Text style={styles.sectionNumber}>{index + 1}</Text>
              <Text style={styles.sectionHeading}>{section.title}</Text>
              <Text style={styles.body}>{section.text}</Text>
            </View>
          ))}
        </View>

        <View style={styles.contact}>
          <TouchableOpacity
            style={styles.contactLink}
            onPress={openSupportEmail}
            accessibilityRole="button"
            accessibilityLabel="Contact support about terms"
          >
            <Mail size={14} color={colors.gold} />
            <Text style={styles.contactLinkText}>{supportEmail}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const SECTION_NUMBER_WIDTH = 32;

const styles = StyleSheet.create({
  paper: {
    flex: 1,
    backgroundColor: colors.background,
  },
  document: {
    paddingHorizontal: 22,
    paddingBottom: 48,
  },
  backButton: {
    padding: 4,
    marginBottom: 24,
    alignSelf: "flex-start",
  },
  header: {
    marginBottom: 28,
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  version: {
    color: colors.textMuted,
    fontSize: 12,
    fontVariant: ["small-caps"],
  },
  rule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginTop: 22,
  },
  lead: {
    color: colors.textBody,
    fontSize: 15,
    lineHeight: 23,
    marginBottom: 24,
  },
  sectionsList: {
    gap: 22,
  },
  section: {
    position: "relative",
    paddingLeft: SECTION_NUMBER_WIDTH + 8,
  },
  sectionNumber: {
    position: "absolute",
    left: 0,
    top: 0,
    width: SECTION_NUMBER_WIDTH,
    fontSize: 15,
    fontWeight: "700",
    color: colors.gold,
    textAlign: "right",
  },
  sectionHeading: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "600",
    marginBottom: 8,
  },
  body: {
    color: colors.textBody,
    fontSize: 13,
    lineHeight: 20,
  },
  contact: {
    marginTop: 24,
  },
  contactLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
  },
  contactLinkText: {
    color: colors.textBodyAlt,
    fontSize: 13,
    textDecorationLine: "underline",
  },
});
