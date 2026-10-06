import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Users, ChevronRight } from "lucide-react-native";
import { activeMembers, currentReceiver, groupProgress, roundStatus } from "../../services/susu";
import colors from "../../theme/colors";

const STATUS_META = {
  ready: { label: "Pot full", color: colors.success },
  short: { label: "Below target", color: colors.amber },
  collecting: { label: "Collecting", color: colors.gold },
  done: { label: "Cycle complete", color: colors.textMuted },
};

export default function SusuGroupCard({ group, userId, onPress }) {
  const roster = activeMembers(group);
  const receiver = currentReceiver(group);
  const done = !group.isActive;
  const status = STATUS_META[done ? "done" : roundStatus(group)];
  const myTurn = receiver && receiver.id === userId;
  const progress = groupProgress(group);

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.topRow}>
        <View style={styles.iconWrap}>
          <Users size={20} color={colors.background} />
        </View>
        <View style={styles.titleWrap}>
          <Text style={styles.name} numberOfLines={1}>{group.name}</Text>
          <Text style={styles.meta}>
            Round {group.currentRound} of {group.totalRounds} · {roster.length} members
          </Text>
        </View>
        <ChevronRight size={20} color={colors.textMuted} />
      </View>

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${Math.max(4, progress * 100)}%` }]} />
      </View>

      <View style={styles.bottomRow}>
        <View>
          <Text style={styles.pot}>GHC {group.targetAmount.toLocaleString()}</Text>
          <Text style={styles.potLabel}>pot per round</Text>
        </View>
        <View style={styles.turnWrap}>
          <Text style={styles.turnLabel}>{done ? "Next" : myTurn ? "Your turn next" : "Next collector"}</Text>
          <Text style={[styles.turnName, myTurn && styles.turnNameHighlight]} numberOfLines={1}>
            {receiver ? receiver.name : "—"}
          </Text>
        </View>
        <View style={[styles.badge, { borderColor: status.color }]}>
          <Text style={[styles.badgeText, { color: status.color }]}>{status.label}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  topRow: { flexDirection: "row", alignItems: "center" },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: colors.gold,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  titleWrap: { flex: 1 },
  name: { color: colors.text, fontSize: 17, fontWeight: "700" },
  meta: { color: colors.textMuted, fontSize: 13, marginTop: 3 },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.borderSubtle,
    marginTop: 14,
    overflow: "hidden",
  },
  progressFill: { height: "100%", backgroundColor: colors.gold, borderRadius: 3 },
  bottomRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginTop: 14,
  },
  pot: { color: colors.text, fontSize: 18, fontWeight: "800" },
  potLabel: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  turnWrap: { flex: 1, marginLeft: 16, alignItems: "center" },
  turnLabel: { color: colors.textMuted, fontSize: 11 },
  turnName: { color: colors.text, fontSize: 14, fontWeight: "600", marginTop: 2 },
  turnNameHighlight: { color: colors.gold },
  badge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: { fontSize: 11, fontWeight: "700" },
});