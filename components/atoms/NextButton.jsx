import React from "react";
import { Pressable, Text, StyleSheet } from "react-native";

export default function NextButton({ onPress, isLastSlide }) {
  return (
    <Pressable style={styles.button} onPress={onPress}>
      <Text style={styles.text}>{isLastSlide ? "Get Started" : "Next"}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingHorizontal: 28, // Generous horizontal cushion for the pill shape
    backgroundColor: "#fbb81c", // Your beautiful yellow accent color
    borderRadius: 50,
    height: 50, // Fixed height is perfect for matching standard native buttons
    justifyContent: "center",
    alignItems: "center",
    minWidth: 120, // Guarantees "Next" has a solid, premium width footprint!
  },
  text: {
    color: "#0f0f0f",
    fontSize: 16,
    fontWeight: "bold",
  },
});
