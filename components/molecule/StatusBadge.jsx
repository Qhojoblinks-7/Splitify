import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { RotateCw, ShieldCheck, TriangleAlert, CircleSlash, CloudOff, Clock } from "lucide-react-native";
import colors from "../../theme/colors";

const META = {
  verified: { label: "Verified", color: colors.success, Icon: ShieldCheck },
  pending: { label: "Verifying", color: colors.gold, Icon: Clock },
  queued: { label: "Queued", color: colors.gold, Icon: RotateCw },
  offline: { label: "Saved offline", color: colors.textDisabled, Icon: CloudOff },
  failed: { label: "Failed", color: colors.danger, Icon: CircleSlash },
  flagged: { label: "Flagged", color: colors.danger, Icon: TriangleAlert },
  processing: { label: "Sending", color: colors.gold, Icon: RotateCw },
  completed: { label: "Paid out", color: colors.success, Icon: ShieldCheck },
  skipped: { label: "Round skipped", color: colors.amber, Icon: TriangleAlert },
};

export function contributionState(contribution) {
  if (contribution.status === "pending" && contribution.syncState === "offline") return "offline";
  if (contribution.status === "pending" && contribution.syncState === "queued") return "queued";
  return contribution.status;
}

export default function StatusBadge({ status, syncState, compact = false, onPress }) {
  const key = status === "pending" && syncState ? (syncState === "offline" ? "offline" : "queued") : status;
  const meta = META[key] || { label: status, color: colors.textMuted, Icon: Clock };
  const { Icon } = meta;

  const body = (
    <View style={[styles.badge, { borderColor: meta.color }, compact && styles.badgeCompact]}>
      <Icon size={compact ? 11 : 13} color={meta.color} />
      <Text style={[styles.text, { color: meta.color }]}>{meta.label}</Text>
    </View>
  );

  if (!onPress) return body;

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      {body}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    alignSelf: "flex-start",
  },
  badgeCompact: { paddingHorizontal: 8, paddingVertical: 3 },
  text: { fontSize: 11, fontWeight: "700" },
});

export { META as STATUS_META };
