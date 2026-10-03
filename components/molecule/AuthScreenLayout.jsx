import React from "react";
import { View, Text, StyleSheet } from "react-native";

export default function AuthScreenLayout({ title, children, footer, brand }) {
  return (
    <View style={styles.Container}>
      <View style={styles.top}>
        {brand ? <Text style={styles.brand}>{brand}</Text> : null}
        {title ? <Text style={styles.title}>{title}</Text> : null}
        <View style={styles.content}>{children}</View>
      </View>
      <View style={styles.spacer} />
      <View style={styles.footer}>{footer}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  Container: {
    flex: 1,
    backgroundColor: "#16171b",
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 24,
  },
  top: {
    width: "100%",
    alignItems: "flex-start",
  },
  content: {
    width: "100%",
    marginTop: 10,
  },
  spacer: {
    flex: 1,
  },
  footer: {
    width: "100%",
    alignItems: "center",
  },
  brand: {
    fontSize: 32,
    fontWeight: "800",
    color: "#ffffff",
    marginBottom: 24,
    letterSpacing: -0.5,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#ffffff",
    marginBottom: 10,
  },
});
