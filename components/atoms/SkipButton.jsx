import React from "react";
import { Pressable, Text, StyleSheet } from "react-native";
import colors from "../../theme/colors";

export default function SkipButton({ onPress }) {
  return (
    <Pressable style={styles.button} onPress={onPress}>
      <Text style={styles.text}>Skip</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingHorizontal: 28, // Matches the exact horizontal layout padding of your NextButton
    backgroundColor: colors.canvas, // Sleek dark mode background canvas
    borderColor: colors.gold, // Premium yellow border frame matching your design
    borderWidth: 1,
    borderRadius: 50,
    height: 50, // Lock this to 50px so it sits on the identical plane line
    justifyContent: "center",
    alignItems: "center",
    minWidth: 120, // Guarantees its baseline box footprint matches NextButton exactly!
  },
  text: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "bold",
  },
});
