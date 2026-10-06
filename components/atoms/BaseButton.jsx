import React from "react";
import colors from "../../theme/colors";
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
            color={variant === "primary" ? colors.canvas : colors.gold}
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
    backgroundColor: colors.gold,
  },
  outlineButton: {
    backgroundColor: colors.canvas,
    borderWidth: 1,
    borderColor: colors.gold,
  },
  secondaryButton: {
    backgroundColor: colors.surfaceAlt, // Your slate gray block
    borderWidth: 1, // Added border width so your color shows up cleanly
    borderColor: colors.divider,
  },
  text: {
    fontSize: 16,
    fontWeight: "bold",
  },
  primaryText: {
    color: colors.canvas,
  },
  outlineText: {
    color: colors.text,
  },
  secondaryText: {
    color: colors.text, // High-contrast white label text to pop off the secondary dark slate
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
