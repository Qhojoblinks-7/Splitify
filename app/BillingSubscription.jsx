import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from "react-native";
import { ChevronLeft, Crown, Calendar, Check } from "lucide-react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function BillingSubscription() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const handleRenew = () => {
    router.push("/UpgradePlan");
  };

  const handleCancel = () => {
    Alert.alert(
      "Cancel Subscription",
      "This will cancel your Pro Annual Plan and stop auto-renewal. You'll keep access until the expiration date.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Cancel Subscription",
          style: "destructive",
          onPress: () => router.push("/(tabs)/account"),
        },
      ]
    );
  };

  const features = [
    "Unlimited groups & expenses",
    "Advanced analytics & reports",
    "Priority support",
    "Custom categories",
    "Data export (CSV/PDF)",
    "No ads",
  ];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} hitSlop={20}>
            <ChevronLeft size={28} color="#ffffff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Bill & Subscription</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Current Subscription Card */}
        <View style={styles.card}>
          <View style={styles.cardTop}>
            <View style={styles.planIcon}>
              <Crown size={24} color="#16171b" />
            </View>
            <View style={styles.planDetails}>
              <Text style={styles.planName}>Pro Annual Plan</Text>
              <Text style={styles.planPrice}>
                $39.99<Text style={styles.planPeriod}> / year</Text>
              </Text>
            </View>
            <View style={styles.statusBadge}>
              <View style={styles.activeDot} />
              <Text style={styles.statusText}>Active</Text>
            </View>
          </View>

          <View style={styles.cardDivider} />

          <View style={styles.billingMeta}>
            <Text style={styles.billingLabel}>Payment method</Text>
            <Text style={styles.billingValue}>Visa  •••• 4242</Text>
          </View>

          <View style={styles.featuresSection}>
            <Text style={styles.featuresTitle}>Included in your plan</Text>
            {features.map((feature, index) => (
              <View key={index} style={styles.featureRow}>
                <Check size={18} color="#4ade80" />
                <Text style={styles.featureText}>{feature}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Expiration & management info (below and outside the card) */}
        <View style={styles.detailsSection}>
          <View style={styles.expiryRow}>
            <Calendar size={18} color="#fbb81c" />
            <Text style={styles.expiryText}>
              Your subscription expires on{" "}
              <Text style={styles.expiryDate}>January 15, 2025</Text>
            </Text>
          </View>

          <Text style={styles.infoText}>
            Your plan stays active until the expiration date. Renew to keep enjoying
            premium features, or cancel anytime to stop automatic billing.
          </Text>

          <Text style={styles.actionHint}>
            Tap "Renew Subscription" below to extend your plan, or tap
            "Cancel Subscription" to review and stop auto-renewal.
          </Text>
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity style={styles.renewBtn} onPress={handleRenew}>
            <Text style={styles.renewBtnText}>Renew Subscription</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel}>
            <Text style={styles.cancelBtnText}>Cancel Subscription</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#16171b" },
  scrollContent: { padding: 20, paddingBottom: 100 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  backBtn: { padding: 4 },
  headerTitle: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "bold",
    flex: 1,
    textAlign: "center",
  },
  headerSpacer: { width: 28 },
  card: {
    backgroundColor: "#2a2b30",
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#3a3b40",
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  planIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#fbb81c",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  planDetails: { flex: 1 },
  planName: { color: "#ffffff", fontSize: 18, fontWeight: "bold", marginBottom: 2 },
  planPrice: { color: "#8e8e93", fontSize: 16 },
  planPeriod: { color: "#8e8e93" },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1e2e20",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 6,
  },
  activeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#4ade80" },
  statusText: { color: "#4ade80", fontSize: 12, fontWeight: "600" },
  cardDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#3a3b40",
    marginVertical: 16,
  },
  billingMeta: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  billingLabel: { color: "#8e8e93", fontSize: 13 },
  billingValue: { color: "#ffffff", fontSize: 13, fontWeight: "600" },
  featuresSection: { marginTop: 16 },
  featuresTitle: { color: "#8e8e93", fontSize: 13, fontWeight: "600", marginBottom: 10 },
  featureRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 },
  featureText: { color: "#ffffff", fontSize: 14 },
  detailsSection: { marginBottom: 24 },
  expiryRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16 },
  expiryText: { color: "#8e8e93", fontSize: 14, lineHeight: 20 },
  expiryDate: { color: "#ffffff", fontWeight: "600" },
  infoText: {
    color: "#8e8e93",
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 12,
    textAlign: "center",
  },
  actionHint: {
    color: "#8e8e93",
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
  },
  actions: { gap: 12 },
  renewBtn: {
    backgroundColor: "#fbb81c",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
  },
  renewBtnText: { color: "#16171b", fontSize: 16, fontWeight: "bold" },
  cancelBtn: {
    backgroundColor: "#2a2b30",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#3a3b40",
  },
  cancelBtnText: { color: "#ff6b6b", fontSize: 16, fontWeight: "600" },
});
