import React from "react";
import {
  Pressable,
  Text,
  View,
  StyleSheet,
  ActivityIndicator,
} from "react-native";

export default function BaseButton({
  title,
  onPress,
  variant = "primary", // Can now be 'primary', 'outline', or 'secondary'
  fullWidth = false,
  icon,
  isLoading = false,
  style,
}) {
  const onPressed = () => {
    if (onPress && typeof onPress === "function") {
      onPress();
    }
  };

  // 1. Dynamic style mapping based on the variant prop
  const buttonStyles = {
    primary: styles.primaryButton,
    outline: styles.outlineButton,
    secondary: styles.secondaryButton,
  };

  const textStyles = {
    primary: styles.primaryText,
    outline: styles.outlineText,
    secondary: styles.secondaryText, // Added high-contrast text mapping for secondary
  };

  return (
    <Pressable
      style={({ pressed }) => [
        styles.button,
        buttonStyles[variant] || styles.primaryButton, // Falls back to primary if variant is missing
        fullWidth ? styles.fullwidth : styles.contentWidth,
        pressed && styles.pressed,
        style,
      ]}
      onPress={onPressed}
      disabled={isLoading}
    >
      <View style={styles.contentRow}>
        {isLoading ? (
          <ActivityIndicator
            color={variant === "primary" ? "#0f0f0f" : "#fbb81c"}
          />
        ) : (
          <>
            {icon && <View style={styles.iconWrapper}>{icon}</View>}

            <Text
              style={[styles.text, textStyles[variant] || styles.primaryText]}
            >
              {title}
            </Text>
          </>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 50,
    borderRadius: 50,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
    minWidth: 120,
  },
  contentRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  iconWrapper: {
    marginRight: 8,
  },
  primaryButton: {
    backgroundColor: "#fbb81c",
  },
  outlineButton: {
    backgroundColor: "#0f0f0f",
    borderWidth: 1,
    borderColor: "#fbb81c",
  },
  secondaryButton: {
    backgroundColor: "#222327", // Your slate gray block
    borderWidth: 1, // Added border width so your color shows up cleanly
    borderColor: "#bbbab7",
  },
  text: {
    fontSize: 16,
    fontWeight: "bold",
  },
  primaryText: {
    color: "#0f0f0f",
  },
  outlineText: {
    color: "#ffffff",
  },
  secondaryText: {
    color: "#ffffff", // High-contrast white label text to pop off the secondary dark slate
  },
  fullwidth: {
    alignSelf: "stretch",
  },
  contentWidth: {
    alignSelf: "auto",
  },
  pressed: {
    opacity: 0.75,
  },
});
