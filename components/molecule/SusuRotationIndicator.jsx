import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Check } from "lucide-react-native";
import { getDayLabel } from "../../utils/dayLabel";

export default function SusuRotationIndicator({ members, currentTurnIndex, payouts = [], userId }) {
  return (
    <View style={styles.container}>
      {members.map((member, index) => {
        const paidRound = payouts.find((p) => p.memberId === member.id && p.status === "completed");
        const isPast = paidRound || index < currentTurnIndex;
        const isCurrent = !paidRound && index === currentTurnIndex;
        const isMe = member.id === userId;

        return (
          <View key={member.id} style={styles.row}>
            <View
              style={[
                styles.avatar,
                isCurrent && styles.avatarCurrent,
                isPast && styles.avatarPast,
              ]}
            >
              <Text style={[styles.avatarText, (isCurrent || isPast) && styles.avatarTextActive]}>
                {member.initials}
              </Text>
              {isPast && (
                <View style={styles.checkWrap}>
                  <Check size={10} color="#16171b" />
                </View>
              )}
            </View>

            <View style={styles.info}>
              <View style={styles.nameRow}>
                <Text style={styles.name} numberOfLines={1}>{member.name}</Text>
                {isMe && <Text style={styles.youTag}>YOU</Text>}
                {member.role === "admin" && <Text style={styles.adminTag}>ADMIN</Text>}
              </View>
              <Text style={styles.status}>
                {paidRound
                  ? `Received round ${paidRound.roundNumber}${
                      paidRound.completedAt ? ` · ${getDayLabel(new Date(paidRound.completedAt))}` : ""
                    }`
                  : isCurrent
                    ? "Collecting the pot now"
                    : `Position ${index + 1}`}
              </Text>
            </View>

            {isCurrent && <Text style={styles.currentTag}>NOW</Text>}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 10 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1e1f24",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#2a2b30",
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#2a2b30",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  avatarCurrent: { backgroundColor: "#fbb81c" },
  avatarPast: { backgroundColor: "#4ade80" },
  avatarText: { color: "#8e8e93", fontSize: 14, fontWeight: "700" },
  avatarTextActive: { color: "#16171b" },
  checkWrap: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#4ade80",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#1e1f24",
  },
  info: { flex: 1 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  name: { color: "#ffffff", fontSize: 15, fontWeight: "600" },
  youTag: {
    color: "#16171b",
    backgroundColor: "#fbb81c",
    fontSize: 9,
    fontWeight: "800",
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    overflow: "hidden",
  },
  adminTag: { color: "#8e8e93", fontSize: 9, fontWeight: "700" },
  status: { color: "#8e8e93", fontSize: 12, marginTop: 2 },
  currentTag: {
    color: "#fbb81c",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
  },
});