import React from "react";
import { View, StyleSheet } from "react-native";
import colors from "../../theme/colors";

export function SkeletonBlock({ width = "100%", height = 14, radius = 6, style }) {
  return <View style={[styles.block, { width, height, borderRadius: radius }, style]} />;
}

export function SusuCardSkeleton() {
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <SkeletonBlock width={42} height={42} radius={12} />
        <View style={styles.titleWrap}>
          <SkeletonBlock width="60%" height={16} />
          <SkeletonBlock width="40%" height={12} style={styles.gap} />
        </View>
      </View>
      <SkeletonBlock width="100%" height={6} radius={3} style={styles.gap} />
      <View style={styles.bottomRow}>
        <SkeletonBlock width={90} height={18} />
        <SkeletonBlock width={70} height={22} radius={999} />
      </View>
    </View>
  );
}

export function SkeletonList({ count = 3 }) {
  return (
    <View>
      {Array.from({ length: count }).map((_, i) => (
        <SusuCardSkeleton key={i} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { backgroundColor: colors.surfaceAlt, opacity: 0.7 },
  gap: { marginTop: 10 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  row: { flexDirection: "row", alignItems: "center" },
  titleWrap: { flex: 1, marginLeft: 12 },
  bottomRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginTop: 14,
  },
});

export default SkeletonBlock;