import React from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { ChevronLeft, Mail } from "lucide-react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { openEmail } from "../utils/openEmail";
import colors from "../theme/colors";

const supportEmail = "support@ntuboa.app";

export default function AboutUs() {
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
          <Text style={styles.title}>About Ntuboa</Text>
          <Text style={styles.version}>Version 1.0</Text>
          <View style={styles.rule} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionNumber}>1</Text>
          <Text style={styles.sectionHeading}>Our mission</Text>
          <Text style={styles.body}>
            Ntuboa helps market associations, family circles, colleagues, and youth groups save
            together with confidence. We make it easy to start a susu group, collect weekly
            contributions, and pay the full pot to each member in turn.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionNumber}>2</Text>
          <Text style={styles.sectionHeading}>What we believe</Text>
          <View style={styles.subItem}>
            <Text style={styles.subHeading}>Simple</Text>
            <Text style={styles.body}>
              Start a susu group and start collecting in minutes, with no paper records.
            </Text>
          </View>
          <View style={styles.subItem}>
            <Text style={styles.subHeading}>Transparent</Text>
            <Text style={styles.body}>
              Every contribution, reference, and payout stays visible to the whole group.
            </Text>
          </View>
          <View style={styles.subItem}>
            <Text style={styles.subHeading}>Secure</Text>
            <Text style={styles.body}>
              Verified mobile money references before any pot is released.
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionNumber}>3</Text>
          <Text style={styles.sectionHeading}>Built for real savings circles</Text>
          <Text style={styles.body}>
            Ntuboa was created to take group susu out of the notebook and into the app, where the
            rotation, the pot, and every cedi contributed can be seen by everyone at once. Our
            goal is simple: grow your wealth together.
          </Text>
        </View>

        <View style={styles.rule} />

        <View style={styles.contact}>
          <Text style={styles.contactHeading}>Questions or ideas?</Text>
          <Text style={styles.note}>We would love to hear from you.</Text>
          <TouchableOpacity
            style={styles.contactLink}
            onPress={openSupportEmail}
            accessibilityRole="button"
            accessibilityLabel="Email support"
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
    marginVertical: 22,
  },
  section: {
    position: "relative",
    paddingLeft: SECTION_NUMBER_WIDTH + 8,
    marginBottom: 22,
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
  subItem: {
    marginBottom: 14,
  },
  subHeading: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 2,
  },
  contact: {
    marginTop: 8,
  },
  contactHeading: {
    color: colors.textMuted,
    fontSize: 11,
    fontVariant: ["small-caps"],
    marginBottom: 4,
  },
  note: {
    color: colors.textBody,
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 6,
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
