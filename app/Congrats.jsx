import React, { useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing } from "react-native";
import { Crown, CheckCircle, Sparkles, ArrowRight } from "lucide-react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function Congrats() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const scaleAnim = new Animated.Value(0);
  const opacityAnim = new Animated.Value(0);
  const sparklesAnim = new Animated.Value(0);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 600,
        easing: Easing.out(Easing.back(1.5)),
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start(() => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(sparklesAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
          Animated.timing(sparklesAnim, { toValue: 0, duration: 0, useNativeDriver: true }),
        ])
      ).start();
    });
  }, []);

  const navigateHome = () => {
    router.replace("/(tabs)/account");
  };

  const scale = scaleAnim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] });
  const sparklesOpacity = sparklesAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
  const sparklesScale = sparklesAnim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1.2] });

  const sparkleTransform = [{ scale: sparklesScale }];

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <Animated.View style={[styles.sparkle, { opacity: sparklesOpacity, transform: sparkleTransform }]}>
        <Sparkles size={60} color="#fbb81c" />
      </Animated.View>

      <View style={styles.content}>
        {/* Success Animation */}
        <Animated.View style={{ transform: [{ scale }] }}>
          <Animated.View style={styles.checkContainer}>
            <CheckCircle size={80} color="#fbb81c" />
          </Animated.View>

          <Crown size={48} color="#fbb81c" style={styles.crown} />

          <Text style={styles.title}>You&apos;re Now Premium!</Text>
          <Text style={styles.subtitle}>Welcome to Splitify Pro</Text>
        </Animated.View>

        {/* Benefits Unlocked */}
        <View style={styles.benefitsContainer}>
          <Text style={styles.benefitsTitle}>Features Unlocked</Text>
          <View style={styles.benefitsGrid}>
            {[
              { icon: "∞", label: "Unlimited Groups" },
              { icon: "📊", label: "Advanced Analytics" },
              { icon: "⚡", label: "Priority Support" },
              { icon: "🎨", label: "Custom Categories" },
              { icon: "📤", label: "Data Export" },
              { icon: "🚫", label: "Ad-Free Experience" },
            ].map((benefit, index) => (
              <View key={index} style={styles.benefitCard}>
                <Text style={styles.benefitIcon}>{benefit.icon}</Text>
                <Text style={styles.benefitLabel}>{benefit.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Next Billing */}
        <View style={styles.billingInfo}>
          <Text style={styles.billingLabel}>Next billing date</Text>
          <Text style={styles.billingDate}>January 15, 2025</Text>
          <Text style={styles.billingAmount}>$39.99 / year</Text>
        </View>

        {/* Continue Button */}
        <TouchableOpacity style={styles.continueBtn} onPress={navigateHome}>
          <Text style={styles.continueBtnText}>Continue to Account</Text>
          <ArrowRight size={20} color="#16171b" style={styles.arrow} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#16171b", alignItems: "center" },
  sparkle: { position: "absolute", top: 60, left: "50%", marginLeft: -30 },
  content: { flex: 1, width: "100%", padding: 20, alignItems: "center", justifyContent: "center" },
  checkContainer: { marginBottom: 16 },
  crown: { marginBottom: 16 },
  title: { color: "#ffffff", fontSize: 28, fontWeight: "bold", textAlign: "center", marginBottom: 8 },
  subtitle: { color: "#8e8e93", fontSize: 16, textAlign: "center", marginBottom: 40 },
  benefitsContainer: { width: "100%", marginBottom: 30 },
  benefitsTitle: { color: "#ffffff", fontSize: 18, fontWeight: "bold", textAlign: "center", marginBottom: 16 },
  benefitsGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 12 },
  benefitCard: {
    width: "45%",
    backgroundColor: "#2a2b30",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#3a3b40",
  },
  benefitIcon: { fontSize: 24, marginBottom: 8 },
  benefitLabel: { color: "#ffffff", fontSize: 13, fontWeight: "600", textAlign: "center" },
  billingInfo: { alignItems: "center", marginBottom: 30, paddingVertical: 20, backgroundColor: "#2a2b30", borderRadius: 16, width: "100%" },
  billingLabel: { color: "#8e8e93", fontSize: 14, marginBottom: 4 },
  billingDate: { color: "#ffffff", fontSize: 18, fontWeight: "bold", marginBottom: 4 },
  billingAmount: { color: "#fbb81c", fontSize: 16, fontWeight: "600" },
  continueBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#fbb81c",
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 32,
    width: "100%",
    justifyContent: "center",
  },
  continueBtnText: { color: "#16171b", fontSize: 16, fontWeight: "bold" },
  arrow: { marginLeft: 4 },
});