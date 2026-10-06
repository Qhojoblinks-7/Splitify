import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Check } from "lucide-react-native";
import { getDayLabel } from "../../utils/dayLabel";
import colors from "../../theme/colors";

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
                  <Check size={10} color={colors.background} />
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
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.borderSubtle,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  avatarCurrent: { backgroundColor: colors.gold },
  avatarPast: { backgroundColor: colors.success },
  avatarText: { color: colors.textMuted, fontSize: 14, fontWeight: "700" },
  avatarTextActive: { color: colors.background },
  checkWrap: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.success,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.surface,
  },
  info: { flex: 1 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  name: { color: colors.text, fontSize: 15, fontWeight: "600" },
  youTag: {
    color: colors.background,
    backgroundColor: colors.gold,
    fontSize: 9,
    fontWeight: "800",
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    overflow: "hidden",
  },
  adminTag: { color: colors.textMuted, fontSize: 9, fontWeight: "700" },
  status: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  currentTag: {
    color: colors.gold,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
  },
});