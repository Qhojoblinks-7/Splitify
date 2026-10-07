import React from "react";
import { View, Text, StyleSheet, Image } from "react-native";
import colors from "../../theme/colors";

/**
 * Splash screen shown while the app initializes.
 * Uses the Ntuboa brand mark and gold accent color.
 */
export default function SplashScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.logoWrapper}>
        <Image
          source={require("../../assets/ntuboa.png")}
          style={styles.logo}
          resizeMode="contain"
        />
      </View>
      <Text style={styles.brand}>Ntuboa</Text>
      <Text style={styles.tagline}>Grow Your Wealth Together</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  logoWrapper: {
    width: 120,
    height: 120,
    borderRadius: 30,
    backgroundColor: colors.gold,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
    marginBottom: 20,
  },
  logo: {
    width: 80,
    height: 80,
  },
  brand: {
    color: colors.text,
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  tagline: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: "600",
  },
});