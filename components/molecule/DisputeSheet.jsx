import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity } from "react-native";
import { Scale, MessageSquare } from "lucide-react-native";
import BottomSheet from "./BottomSheet";
import { DISPUTE_REASONS, RESOLUTIONS } from "../../services/dispute";
import { formatGHC, formatDate } from "../../services/statement";
import colors from "../../theme/colors";

/**
 * Dispute resolution.
 *
 * A flagged contribution blocks the round with no way out, which strands the
 * whole circle. This is the way out: the member states a reason, the admin
 * settles it, and the decision is written into the ledger permanently.
 */
export default function DisputeSheet({
  contribution,
  memberName,
  isAdmin,
  mode,
  isVisible,
  onClose,
  onOpen,
  onResolve,
}) {
  const [reason, setReason] = useState(null);
  const [note, setNote] = useState("");
  const [resolution, setResolution] = useState(null);
  const [error, setError] = useState(null);

  const reset = () => {
    setReason(null);
    setNote("");
    setResolution(null);
    setError(null);
  };

  const close = () => {
    reset();
    onClose();
  };

  const submit = () => {
    if (mode === "open") {
      if (!reason) {
        setError("Choose what is wrong with this contribution.");
        return;
      }
      const result = onOpen({ reason, note });
      if (!result?.ok) {
        setError(result?.message || "This contribution cannot be disputed.");
        return;
      }
      close();
      return;
    }

    if (!resolution) {
      setError("Choose how the dispute is settled.");
      return;
    }
    const result = onResolve({ resolution });
    if (!result?.ok) {
      setError(result?.message || "Only the group admin can settle a dispute.");
      return;
    }
    close();
  };

  if (!contribution) return null;

  const dispute = contribution.dispute;

  return (
    <BottomSheet isVisible={isVisible} onClose={close} title={mode === "open" ? "Dispute this contribution" : "Settle the dispute"}>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <View style={styles.ledgerRow}>
          <View style={styles.ledgerInfo}>
            <Text style={styles.member}>{memberName}</Text>
            <Text style={styles.meta}>
              Round {contribution.roundNumber} · {formatDate(contribution.paidAt)} · {contribution.reference}
            </Text>
          </View>
          <Text style={styles.amount}>GHC {formatGHC(contribution.amount)}</Text>
        </View>

        {mode === "resolve" && dispute ? (
          <View style={styles.callout}>
            <Text style={styles.calloutTitle}>Opened by the member</Text>
            <Text style={styles.calloutText}>
              {dispute.reason ? dispute.reason.replace(/_/g, " ") : "unspecified"}
              {dispute.note ? ` — ${dispute.note}` : ""}
            </Text>
            <Text style={styles.calloutTime}>{formatDate(dispute.openedAt)}</Text>
          </View>
        ) : null}

        {mode === "open" ? (
          <>
            <Text style={styles.label}>What is wrong</Text>
            <View style={styles.optionWrap}>
              {DISPUTE_REASONS.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.option, reason === item.id && styles.optionActive]}
                  onPress={() => {
                    setReason(item.id);
                    setError(null);
                  }}
                >
                  <Scale size={15} color={reason === item.id ? colors.onGold : colors.textMuted} />
                  <Text style={[styles.optionText, reason === item.id && styles.optionTextActive]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Anything to add (optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="What happened?"
              placeholderTextColor={colors.placeholder}
              value={note}
              onChangeText={setNote}
              maxLength={180}
              multiline
            />
            <Text style={styles.counter}>{note.length}/180</Text>

            <View style={styles.warning}>
              <Text style={styles.warningText}>
                The round stays blocked until the admin settles this. Every member can see the
                dispute and its outcome.
              </Text>
            </View>
          </>
        ) : (
          <>
            <Text style={styles.label}>How is it settled</Text>
            <View style={styles.optionWrap}>
              {RESOLUTIONS.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.option, resolution === item.id && styles.optionActive]}
                  onPress={() => {
                    setResolution(item.id);
                    setError(null);
                  }}
                >
                  <Scale size={15} color={resolution === item.id ? colors.onGold : colors.textMuted} />
                  <Text style={[styles.optionText, resolution === item.id && styles.optionTextActive]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.impact}>
              <Text style={styles.impactTitle}>What happens</Text>
              {resolution === "dismissed" ? (
                <Text style={styles.impactText}>
                  The contribution returns to verified, the round unblocks, and the flag count
                  against the admin is undone.
                </Text>
              ) : resolution === "upheld" ? (
                <Text style={styles.impactText}>
                  The contribution is void. GHC {formatGHC(contribution.amount)} is added to what the
                  member owes and carries into their next statement.
                </Text>
              ) : (
                <Text style={styles.impactText}>Choose how the dispute is settled.</Text>
              )}
            </View>
          </>
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.primaryBtn, mode === "resolve" && !isAdmin && styles.primaryBtnDisabled]}
          disabled={mode === "resolve" && !isAdmin}
          onPress={submit}
        >
          <MessageSquare size={18} color={colors.onGold} />
          <Text style={styles.primaryBtnText}>
            {mode === "open" ? "Raise dispute" : "Record decision"}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 20, paddingBottom: 60 },
  ledgerRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: 12,
  },
  ledgerInfo: { flex: 1 },
  member: { color: colors.text, fontSize: 15, fontWeight: "700" },
  meta: { color: colors.textMuted, fontSize: 11, marginTop: 3 },
  amount: { color: colors.text, fontSize: 15, fontWeight: "800", marginLeft: 10 },
  callout: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderLeftWidth: 3,
    borderLeftColor: colors.gold,
    padding: 12,
    marginTop: 12,
  },
  calloutTitle: { color: colors.textMuted, fontSize: 11, fontWeight: "800", textTransform: "uppercase" },
  calloutText: { color: colors.textBody, fontSize: 13, lineHeight: 18, marginTop: 4 },
  calloutTime: { color: colors.textMuted, fontSize: 11, marginTop: 6 },
  label: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginTop: 18,
    marginBottom: 8,
  },
  optionWrap: { gap: 8 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  optionActive: { backgroundColor: colors.gold, borderColor: colors.gold },
  optionText: { color: colors.textBody, fontSize: 13, fontWeight: "600", flex: 1 },
  optionTextActive: { color: colors.onGold, fontWeight: "700" },
  input: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 14,
    minHeight: 84,
    textAlignVertical: "top",
  },
  counter: { color: colors.textMuted, fontSize: 11, textAlign: "right", marginTop: 4 },
  warning: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 12,
    borderLeftWidth: 3,
    borderLeftColor: colors.warning,
    padding: 12,
    marginTop: 16,
  },
  warningText: { color: colors.textBody, fontSize: 12, lineHeight: 17 },
  impact: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 12,
    borderLeftWidth: 3,
    borderLeftColor: "#3b82f6",
    padding: 12,
    marginTop: 16,
  },
  impactTitle: { color: colors.textMuted, fontSize: 11, fontWeight: "800", textTransform: "uppercase" },
  impactText: { color: colors.textBody, fontSize: 12, lineHeight: 17, marginTop: 4 },
  error: { color: colors.danger, fontSize: 13, marginTop: 10 },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.gold,
    borderRadius: 16,
    paddingVertical: 16,
    marginTop: 18,
  },
  primaryBtnDisabled: { backgroundColor: colors.borderSubtle },
  primaryBtnText: { color: colors.onGold, fontSize: 16, fontWeight: "700" },
});