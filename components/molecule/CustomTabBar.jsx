import React from "react";
import { Platform, View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { QrCode, Share } from "lucide-react-native";
import { useTabBarStore } from "../../store/tabBar";

const STANDARD_CUSTOM_TAB_BAR_HEIGHT = Platform.select({
  ios: 49,
  android: 56,
  default: 56,
});

export default function CustomTabBar() {
  const { mode } = useTabBarStore();
  const insets = useSafeAreaInsets();
  const customTabBarHeight = STANDARD_CUSTOM_TAB_BAR_HEIGHT + insets.bottom;

  if (mode === "qr") {
    return (
      <View style={[styles.container, { height: customTabBarHeight, paddingBottom: insets.bottom }]}>
        <TouchableOpacity style={styles.qrTabBtn}>
          <QrCode size={24} color="#16171b" />
          <Text style={styles.qrTabText}>QR Code</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.qrTabBtn}>
          <Share size={24} color="#16171b" />
          <Text style={styles.qrTabText}>Share</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#16171b",
    borderTopWidth: 1,
    borderTopColor: "#2a2b30",
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
  },
  qrTabBtn: {
    flex: 1,
    backgroundColor: "#fbb81c",
    marginHorizontal: 20,
    borderRadius: 16,
    paddingVertical: 12,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },
  qrTabText: { color: "#16171b", fontSize: 14, fontWeight: "bold" },
});