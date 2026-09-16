import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { ChevronLeft, CreditCard, Crown, Calendar, CheckCircle } from "lucide-react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function ReviewSummary() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const plan = { name: "Yearly", price: "$39.99", period: "/year", save: "Save 33%" };
  const card = { brand: "Visa", last4: "4242", expiry: "12/28" };

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
          <Text style={styles.title}>Review Summary</Text>
          <Text style={styles.subtitle}>Confirm your upgrade details</Text>
        </View>

        {/* Plan Summary */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryLeft}>
              <Crown size={24} color="#fbb81c" />
              <View>
                <Text style={styles.summaryTitle}>{plan.name} Plan</Text>
                <Text style={styles.summarySubtitle}>{plan.price} {plan.period}  {plan.save && <Text style={styles.saveText}>({plan.save})</Text>}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Payment Method */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryLeft}>
              <CreditCard size={24} color="#fbb81c" />
              <View>
                <Text style={styles.summaryTitle}>Payment Method</Text>
                <Text style={styles.summarySubtitle}>{card.brand} ending in {card.last4} · Expires {card.expiry}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Billing Details */}
        <View style={styles.summaryCard}>
          <Text style={styles.sectionTitle}>Billing Details</Text>
          <View style={styles.billingRow}>
            <Text style={styles.billingLabel}>Subtotal</Text>
            <Text style={styles.billingValue}>{plan.price}</Text>
          </View>
          <View style={styles.billingRow}>
            <Text style={styles.billingLabel}>Tax</Text>
            <Text style={styles.billingValue}>$0.00</Text>
          </View>
          <View style={styles.billingRowTotal}>
            <Text style={styles.billingLabel}>Total</Text>
            <Text style={styles.billingValueTotal}>{plan.price} {plan.period}</Text>
          </View>
        </View>

        {/* Features */}
        <View style={styles.summaryCard}>
          <Text style={styles.sectionTitle}>What's Included</Text>
          {features.map((feature, index) => (
            <View key={index} style={styles.featureRow}>
              <CheckCircle size={20} color="#fbb81c" style={styles.featureIcon} />
              <Text style={styles.featureText}>{feature}</Text>
            </View>
          ))}
        </View>

        {/* Terms */}
        <View style={styles.termsRow}>
          <Text style={styles.termsText}>
            By continuing, you agree to our{" "}
            <Text style={styles.linkText}>Terms of Service</Text>{" "}
            and{" "}
            <Text style={styles.linkText}>Privacy Policy</Text>.
          </Text>
        </View>

        {/* Confirm Button */}
        <TouchableOpacity style={styles.confirmBtn} onPress={() => router.push("/Congrats")}>
          <Text style={styles.confirmBtnText}>Confirm & Subscribe</Text>
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
  subtitle: { color: "#8e8e93", fontSize: 16, marginTop: 4 },
  summaryCard: {
    backgroundColor: "#2a2b30",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  summaryRow: { flexDirection: "row", alignItems: "center" },
  summaryLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  summaryTitle: { color: "#ffffff", fontSize: 16, fontWeight: "600" },
  summarySubtitle: { color: "#8e8e93", fontSize: 13, marginTop: 2 },
  saveText: { color: "#fbb81c", fontWeight: "bold" },
  sectionTitle: { color: "#ffffff", fontSize: 16, fontWeight: "bold", marginBottom: 12 },
  billingRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#3a3b40" },
  billingRowTotal: { flexDirection: "row", justifyContent: "space-between", paddingTop: 12 },
  billingLabel: { color: "#8e8e93", fontSize: 16 },
  billingValue: { color: "#ffffff", fontSize: 16, fontWeight: "600" },
  billingValueTotal: { color: "#fbb81c", fontSize: 20, fontWeight: "bold" },
  featureRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8 },
  featureIcon: { flexShrink: 0 },
  featureText: { color: "#ffffff", fontSize: 15 },
  termsRow: { marginTop: 20, marginBottom: 20, alignItems: "center" },
  termsText: { color: "#8e8e93", fontSize: 13, textAlign: "center", lineHeight: 20 },
  linkText: { color: "#fbb81c", fontWeight: "600" },
  confirmBtn: {
    backgroundColor: "#fbb81c",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
  },
  confirmBtnText: { color: "#16171b", fontSize: 16, fontWeight: "bold" },
});