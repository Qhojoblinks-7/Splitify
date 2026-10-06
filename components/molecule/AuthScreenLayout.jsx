import React from "react";
import { View, Text, Image, StyleSheet } from "react-native";

export default function AuthScreenLayout({ title, children, footer }) {
  return (
    <View style={styles.Container}>
      <Image source={require("../../assets/ntuboa.png")} style={styles.logo} />
      {title ? <Text style={styles.title}>{title}</Text> : null}
      <View style={styles.content}>{children}</View>
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  Container: {
    flex: 1,
    backgroundColor: "#16171b",
    paddingHorizontal: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  logo: {
    width: 200,
    height: 80,
    resizeMode: "contain",
    marginBottom: 16,
  },
  content: {
    width: "100%",
    alignItems: "stretch",
  },
  footer: {
    width: "100%",
    alignItems: "center",
    marginTop: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#ffffff",
    marginBottom: 24,
    textAlign: "center",
  },
});
