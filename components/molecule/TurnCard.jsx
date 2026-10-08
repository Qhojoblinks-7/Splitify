import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { formatDate, formatGHC } from "../../services/statement";
import colors from "../../theme/colors";

export default function TurnCard({ view }) {
  const me = view.roster?.find((entry) => entry.isMe);
  const receiver = view.payout?.receiverMembershipId === view.myMembershipId;
  const collected = receiver && view.payout;

  const amount = view.payout?.amount ?? "0.00";
  const when = view.payout?.completedAt ? formatDate(view.payout.completedAt) : "";

  const contributed =
    typeof view.verified === "string"
      ? formatGHC(parseFloat(view.verified) || 0)
      : formatGHC(view.verified || 0);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.groupName}>{view.groupName || "Your group"}</Text>
        <Text style={styles.roundBadge}>Round {view.number}</Text>
      </View>

      <View style={styles.body}>
        <Text style={styles.memberName}>
          {me?.name || "Me"}{" "}
          <Text style={styles.memberStatus}>{collected ? "· received" : "· contributed"}</Text>
        </Text>

        {collected && (
          <Text style={styles.collectedAmount}>GH¢ {amount}</Text>
        )}

        {when ? <Text style={styles.date}>{when}</Text> : null}

        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Contributed</Text>
          <Text style={styles.summaryValue}>GH¢ {contributed}</Text>
        </View>

        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Cycle</Text>
          <Text style={styles.summaryValue}>{view.cycle || 1}</Text>
        </View>
      </View>

      {!collected && (
        <Text style={styles.pending}>
          Your payout is on its way. You will receive a receipt here when it arrives.
        </Text>
      )}
    </View>
  );
}

const CARD_WIDTH = 360;

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    backgroundColor: colors.canvas,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  groupName: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
  },
  roundBadge: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "600",
    backgroundColor: colors.surfaceAlt,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  body: {
    paddingHorizontal: 20,
    paddingVertical: 18,
    gap: 8,
  },
  memberName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "600",
  },
  memberStatus: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "400",
  },
  collectedAmount: {
    color: colors.success,
    fontSize: 32,
    fontWeight: "800",
    marginTop: 12,
  },
  date: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 4,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  summaryLabel: {
    color: colors.textBody,
    fontSize: 13,
  },
  summaryValue: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "700",
  },
  pending: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
});
