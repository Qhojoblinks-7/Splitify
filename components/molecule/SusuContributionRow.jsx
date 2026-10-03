import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { CheckCircle2, Clock, AlertTriangle, ShieldCheck, XCircle, CloudOff, RotateCw, Scale } from "lucide-react-native";

const STATUS = {
  verified: { label: "Verified", color: "#4ade80", Icon: CheckCircle2 },
  pending: { label: "Verifying", color: "#fbb81c", Icon: Clock },
  queued: { label: "Queued", color: "#fbb81c", Icon: RotateCw },
  offline: { label: "Saved offline", color: "#a1a1aa", Icon: CloudOff },
  failed: { label: "Failed", color: "#ef4444", Icon: XCircle },
  flagged: { label: "Flagged", color: "#ef4444", Icon: AlertTriangle },
  disputed: { label: "Disputed", color: "#fbb81c", Icon: Scale },
};

/**
 * A contribution recorded with no signal is not the same as one waiting on a
 * payment provider. The member must be able to tell which state their money is
 * actually in, so the sync state takes precedence over the raw status.
 */
export function resolveStatus(contribution) {
  if (contribution.status === "pending" && contribution.syncState === "offline") return "offline";
  if (contribution.status === "pending" && contribution.syncState === "queued") return "queued";
  return contribution.status;
}

export default function SusuContributionRow({ contribution, memberName, memberInitials, avatarColor, providerLabel }) {
  const key = resolveStatus(contribution);
  const meta = STATUS[key] || STATUS.pending;
  const { Icon } = meta;
  const failed = contribution.status === "failed";
  const unsynced = key === "offline" || key === "queued";
  const disputed = key === "disputed";

  return (
    <View style={[styles.row, failed && styles.rowFailed, unsynced && styles.rowUnsynced, disputed && styles.rowDisputed]}>
      <View style={[styles.avatar, { backgroundColor: avatarColor || "#2a2b30" }]}>
        <Text style={styles.avatarText}>{memberInitials || "?"}</Text>
      </View>

      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>{memberName || "Member"}</Text>
        <View style={styles.subRow}>
          <ShieldCheck size={12} color="#8e8e93" />
          <Text style={styles.ref} numberOfLines={1}>
            {providerLabel} · {contribution.reference}
          </Text>
        </View>
        {failed && contribution.failedReason ? (
          <Text style={styles.reason} numberOfLines={2}>{contribution.failedReason}</Text>
        ) : disputed && contribution.dispute ? (
          <Text style={styles.disputeNote} numberOfLines={2}>
            Disputed{contribution.dispute.resolvedBy ? " and settled" : " — awaiting the admin"}:{" "}
            {String(contribution.dispute.reason || "").replace(/_/g, " ")}
            {contribution.dispute.note ? `. ${contribution.dispute.note}` : ""}
          </Text>
        ) : unsynced ? (
          <Text style={styles.pendingNote} numberOfLines={2}>
            Recorded on this phone. We will check it with your mobile money provider once you have signal.
          </Text>
        ) : null}
      </View>

      <View style={styles.right}>
        <Text style={styles.amount}>GHC {contribution.amount.toLocaleString()}</Text>
        <View style={styles.statusRow}>
          <Icon size={12} color={meta.color} />
          <Text style={[styles.statusText, { color: meta.color }]}>{meta.label}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1e1f24",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#2a2b30",
  },
  rowFailed: { borderColor: "#ef4444", opacity: 0.9 },
  rowUnsynced: { borderColor: "#4b5563", borderStyle: "dashed" },
  rowDisputed: { borderColor: "#fbb81c" },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  avatarText: { color: "#16171b", fontSize: 13, fontWeight: "800" },
  info: { flex: 1 },
  name: { color: "#ffffff", fontSize: 15, fontWeight: "600" },
  subRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 },
  ref: { color: "#8e8e93", fontSize: 11, flexShrink: 1 },
  reason: { color: "#ef4444", fontSize: 11, marginTop: 4 },
  pendingNote: { color: "#8e8e93", fontSize: 11, marginTop: 4, lineHeight: 15 },
  disputeNote: { color: "#fbb81c", fontSize: 11, marginTop: 4, lineHeight: 15 },
  right: { alignItems: "flex-end", marginLeft: 10 },
  amount: { color: "#ffffff", fontSize: 14, fontWeight: "700" },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 },
  statusText: { fontSize: 11, fontWeight: "600" },
});