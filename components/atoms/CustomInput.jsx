import React, { useState } from "react";
import { TextInput, StyleSheet, View, Text, Pressable } from "react-native";
import { Eye, EyeOff } from "lucide-react-native";

export default function CustomInput({
  label,
  iconLeft,
  iconRight,
  secureTextEntry, // FIXED: Corrected spelling to match standard React Native guidelines
  style, // Captures structural external margins/widths
  ...props // Passes placeholderTextColor, value, onChangeText, etc., down seamlessly
}) {
  const [isFocused, setIsFocused] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false); // FIXED: Squashed a subtle internal casing typo

  const togglePasswordVisible = () => {
    setIsPasswordVisible(!isPasswordVisible);
  };

  return (
    <View style={[styles.container, style]}>
      {label && <Text style={styles.label}>{label}</Text>}

      {/* FIXED: Look closely here! If you pass custom border rules down from Login.jsx,
              we extract them from props (or let focus states override them) right here on the layout box!
            */}
      <View
        style={[
          styles.inputContainer,
          isFocused && styles.focusedInputContainer,
          props.borderColor ? { borderColor: props.borderColor } : null,
        ]}
      >
        {iconLeft && <View style={styles.iconLeft}>{iconLeft}</View>}

        <TextInput
          style={styles.textInput}
          secureTextEntry={secureTextEntry && !isPasswordVisible}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholderTextColor="#666666" // Premium dark-mode gray default placeholder fallback
          {...props} // Drills your custom configurations right down into the processing layer
        />

        {secureTextEntry && (
          <Pressable onPress={togglePasswordVisible} style={styles.iconRight}>
            {/* Styled the text color so your toggle labels display beautifully in dark mode! */}
            {isPasswordVisible ? (
              <EyeOff size={20} color="#fbb81c" />
            ) : (
              <Eye size={20} color="#666666" />
            )}
          </Pressable>
        )}

        {iconRight && !secureTextEntry && (
          <View style={styles.iconRight}>{iconRight}</View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    marginBottom: 16,
  },
  label: {
    marginBottom: 8,
    fontSize: 14,
    color: "#ffffff",
    fontWeight: "600",
  },
  inputContainer: {
    height: 54,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#33353b", // Gave it a default slate boundary so it's visible on pure black backdrops
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: "#222327",
  },
  focusedInputContainer: {
    borderColor: "#fbb81c", // Instantly lights up with Splitify's signature gold color when active!
  },
  textInput: {
    flex: 1,
    height: "100%", // Fills up the bounding container space so tapping anywhere selects the text cursor
    color: "#ffffff",
    fontSize: 16,
  },
  iconLeft: {
    marginRight: 8,
  },
  iconRight: {
    marginLeft: 8,
  },
  toggleText: {
    color: "#fbb81c", // Custom gold accents for your text view toggles
    fontWeight: "600",
    fontSize: 14,
  },
});
