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
      <Image
        source={require("../../assets/ntuboa.png")}
        style={styles.logo}
        resizeMode="contain"
      />
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
  logo: {
    width: 200,
    height: 55,
    marginBottom: 5,
  },
  tagline: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: "600",
  },
});