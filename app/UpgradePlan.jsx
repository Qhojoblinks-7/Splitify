import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { ChevronLeft, Crown, Check, Star } from "lucide-react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function UpgradePlan() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [selectedPlan, setSelectedPlan] = useState("monthly");

  const plans = [
    { id: "monthly", name: "Monthly", price: "$4.99", period: "/month", popular: false },
    { id: "yearly", name: "Yearly", price: "$39.99", period: "/year", popular: true, save: "Save 33%" },
  ];

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
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Back Button */}
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ChevronLeft size={28} color="#ffffff" />
        </TouchableOpacity>

        {/* Header */}
        <View style={styles.header}>
          <Crown size={32} color="#fbb81c" />
          <Text style={styles.title}>Upgrade Plan</Text>
        </View>

        {/* Plan Cards */}
        <View style={styles.plansContainer}>
          {plans.map((plan) => (
            <TouchableOpacity
              key={plan.id}
              style={[styles.planCard, selectedPlan === plan.id && styles.planCardSelected]}
              onPress={() => setSelectedPlan(plan.id)}
            >
              {plan.popular && <View style={styles.popularBadge}><Text style={styles.popularText}>Most Popular</Text></View>}
              <View style={styles.planHeader}>
                <Text style={styles.planName}>{plan.name}</Text>
                {plan.save && <Text style={styles.saveText}>{plan.save}</Text>}
              </View>
              <View style={styles.priceRow}>
                <Text style={styles.price}>{plan.price}</Text>
                <Text style={styles.period}>{plan.period}</Text>
              </View>
              <View style={styles.checkContainer}>
                <Check size={24} color={selectedPlan === plan.id ? "#fbb81c" : "#2a2b30"} />
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Features */}
        <View style={styles.featuresSection}>
          <Text style={styles.sectionTitle}>Premium Features</Text>
          {features.map((feature, index) => (
            <View key={index} style={styles.featureRow}>
              <Star size={18} color="#fbb81c" style={styles.featureIcon} />
              <Text style={styles.featureText}>{feature}</Text>
            </View>
          ))}
        </View>

        {/* Continue Button */}
        <TouchableOpacity style={styles.continueBtn} onPress={() => router.push("/SelectPaymentMethod")}>
          <Text style={styles.continueBtnText}>Continue</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#16171b" },
  scrollContent: { padding: 20, paddingBottom: 100 },
  backBtn: { padding: 4, marginBottom: 20 },
  header: { alignItems: "center", marginBottom: 30 },
  title: { color: "#ffffff", fontSize: 28, fontWeight: "bold", marginTop: 12 },
  plansContainer: { gap: 12, marginBottom: 30 },
  planCard: {
    flex: 1,
    backgroundColor: "#2a2b30",
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "transparent",
  },
  planCardSelected: { borderColor: "#fbb81c" },
  popularBadge: {
    position: "absolute",
    top: -10,
    backgroundColor: "#fbb81c",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  popularText: { color: "#16171b", fontSize: 12, fontWeight: "bold" },
  planHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  planName: { color: "#ffffff", fontSize: 18, fontWeight: "bold" },
  saveText: { color: "#fbb81c", fontSize: 12, fontWeight: "bold" },
  priceRow: { alignItems: "baseline", marginBottom: 16 },
  price: { color: "#ffffff", fontSize: 36, fontWeight: "bold" },
  period: { color: "#8e8e93", fontSize: 16, marginLeft: 4 },
  checkContainer: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: "#8e8e93", justifyContent: "center", alignItems: "center" },
  featuresSection: { marginBottom: 30 },
  sectionTitle: { color: "#ffffff", fontSize: 18, fontWeight: "bold", marginBottom: 16 },
  featureRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8 },
  featureIcon: { flexShrink: 0 },
  featureText: { color: "#ffffff", fontSize: 16 },
  continueBtn: {
    backgroundColor: "#fbb81c",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    marginTop: 20,
  },
  continueBtnText: { color: "#16171b", fontSize: 16, fontWeight: "bold" },
});