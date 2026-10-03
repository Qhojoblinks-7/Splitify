import React from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { ChevronLeft, Info, Users, ShieldCheck, Heart, Globe, Mail } from "lucide-react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { openEmail } from "../utils/openEmail";

const supportEmail = "support@growl.app";

const values = [
  {
    id: "simple",
    title: "Simple",
    text: "Start a susu group and start collecting in minutes, with no paper records.",
    icon: Heart,
  },
  {
    id: "transparent",
    title: "Transparent",
    text: "Every contribution, reference, and payout stays visible to the whole group.",
    icon: Info,
  },
  {
    id: "secure",
    title: "Secure",
    text: "Verified mobile money references before any pot is released.",
    icon: ShieldCheck,
  },
];

export default function AboutUs() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const openSupportEmail = () => openEmail(supportEmail);

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
            <Info size={30} color="#16171b" />
          </View>
          <Text style={styles.title}>About Growl</Text>
        </View>

        <View style={styles.missionCard}>
          <Text style={styles.missionTitle}>Our mission</Text>
          <Text style={styles.missionText}>
            Growl helps market associations, family circles, colleagues, and youth groups save
            together with confidence. We make it easy to start a susu group, collect weekly
            contributions, and pay the full pot to each member in turn.
          </Text>
        </View>

        <Text style={styles.sectionHeading}>What we believe</Text>
        <View style={styles.valuesList}>
          {values.map((value) => {
            const Icon = value.icon;

            return (
              <View key={value.id} style={styles.valueCard}>
                <View style={styles.valueIcon}>
                  <Icon size={22} color="#16171b" />
                </View>
                <View style={styles.valueCopy}>
                  <Text style={styles.valueTitle}>{value.title}</Text>
                  <Text style={styles.valueText}>{value.text}</Text>
                </View>
              </View>
            );
          })}
        </View>

        <View style={styles.storyCard}>
          <Users size={24} color="#fbb81c" style={styles.storyIcon} />
          <Text style={styles.storyTitle}>Built for real savings circles</Text>
          <Text style={styles.storyText}>
            Growl was created to take group susu out of the notebook and into the app, where the
            rotation, the pot, and every cedi contributed can be seen by everyone at once.
            Our goal is simple: grow your wealth together.
          </Text>
        </View>

        <View style={styles.contactCard}>
          <Globe size={22} color="#fbb81c" />
          <View style={styles.contactCopy}>
            <Text style={styles.contactTitle}>Questions or ideas?</Text>
            <Text style={styles.contactText}>We would love to hear from you.</Text>
          </View>
          <TouchableOpacity style={styles.contactButton} onPress={openSupportEmail}>
            <Mail size={17} color="#16171b" />
            <Text style={styles.contactButtonText}>Email us</Text>
          </TouchableOpacity>
        </View>
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
  missionCard: {
    backgroundColor: "#2a2b30",
    borderRadius: 18,
    padding: 20,
    marginBottom: 26,
    borderWidth: 1,
    borderColor: "#fbb81c",
  },
  missionTitle: {
    color: "#fbb81c",
    fontSize: 14,
    fontWeight: "bold",
    textTransform: "uppercase",
  },
  missionText: {
    color: "#ffffff",
    fontSize: 16,
    lineHeight: 24,
    marginTop: 10,
  },
  sectionHeading: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 14,
  },
  valuesList: {
    gap: 12,
    marginBottom: 26,
  },
  valueCard: {
    flexDirection: "row",
    gap: 14,
    backgroundColor: "#2a2b30",
    borderRadius: 16,
    padding: 16,
  },
  valueIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#fbb81c",
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  valueCopy: {
    flex: 1,
  },
  valueTitle: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 4,
  },
  valueText: {
    color: "#8e8e93",
    fontSize: 14,
    lineHeight: 21,
  },
  storyCard: {
    backgroundColor: "#2a2b30",
    borderRadius: 16,
    padding: 18,
    marginBottom: 20,
  },
  storyIcon: {
    marginBottom: 10,
  },
  storyTitle: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "bold",
    marginBottom: 6,
  },
  storyText: {
    color: "#8e8e93",
    fontSize: 14,
    lineHeight: 21,
  },
  contactCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#16171b",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#3a3b40",
  },
  contactCopy: {
    flex: 1,
  },
  contactTitle: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "bold",
  },
  contactText: {
    color: "#8e8e93",
    fontSize: 13,
    marginTop: 2,
  },
  contactButton: {
    minHeight: 40,
    borderRadius: 10,
    backgroundColor: "#fbb81c",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  contactButtonText: {
    color: "#16171b",
    fontSize: 13,
    fontWeight: "bold",
  },
});
