import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { Share, Platform } from "react-native";
import * as Clipboard from "expo-clipboard";
import { FileText, Copy, Share2, Check } from "lucide-react-native";
import BottomSheet from "./BottomSheet";
import { toast } from "../../utils/alert";
import {
  memberStatement,
  groupStatement,
  toCSV,
  toText,
  formatGHC,
  suggestedFileName,
} from "../../services/statement";
import colors from "../../theme/colors";

const SCOPES = [
  { id: "group", label: "Whole group" },
  { id: "member", label: "Just me" },
];

const FORMATS = [
  { id: "text", label: "For WhatsApp" },
  { id: "csv", label: "CSV for Excel" },
];

/**
 * Statement export.
 *
 * Credit unions and SACCOs open these in Excel; members forward them to family
 * on WhatsApp. Both are offered because neither format substitutes for the
 * other, and the CSV path is what makes the paid institutional tier credible.
 */
export default function StatementSheet({ group, userId, isVisible, onClose }) {
  const [scope, setScope] = useState("group");
  const [format, setFormat] = useState("text");
  const [copied, setCopied] = useState(false);

  const memberMode = scope === "member";

  const statement = useMemo(() => {
    if (!group) return null;
    return memberMode ? memberStatement(group, userId) : groupStatement(group);
  }, [group, memberMode, userId]);

  const fileName = useMemo(
    () => (statement ? suggestedFileName(statement, { memberMode }) : "statement.csv"),
    [statement, memberMode]
  );

  const rows = statement ? statement.lines || statement.rows : [];

  const onShare = async () => {
    if (!statement) return;
    const body = format === "csv" ? toCSV(statement, { memberMode }) : toText(statement, { memberMode });

    try {
      if (format === "csv") {
        await Clipboard.setStringAsync(body);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
        toast.success("CSV copied. Paste it into Excel or Sheets.");
        return;
      }
      await Share.share(
        Platform.OS === "android"
          ? { message: body, title: fileName.replace(/\.csv$/, "") }
          : { message: body }
      );
    } catch {
      toast.error("We could not share that statement. Copy it instead.");
    }
  };

  if (!group || !statement) return null;

  return (
    <BottomSheet isVisible={isVisible} onClose={onClose} title="Export statement">
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Text style={styles.groupName}>{statement.groupName}</Text>

        <Text style={styles.label}>Who is this for</Text>
        <View style={styles.chipRow}>
          {SCOPES.map((option) => (
            <TouchableOpacity
              key={option.id}
              style={[styles.chip, scope === option.id && styles.chipActive]}
              onPress={() => setScope(option.id)}
            >
              <Text style={[styles.chipText, scope === option.id && styles.chipTextActive]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Format</Text>
        <View style={styles.chipRow}>
          {FORMATS.map((option) => (
            <TouchableOpacity
              key={option.id}
              style={[styles.chip, scope === option.id && styles.chipActive]}
              onPress={() => setFormat(option.id)}
            >
              <Text style={[styles.chipText, format === option.id && styles.chipTextActive]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.summary}>
          {memberMode ? (
            <>
              <SummaryCell label="Contributed" value={`GHC ${formatGHC(statement.contributed)}`} />
              <SummaryCell label="Received" value={`GHC ${formatGHC(statement.received)}`} />
              <SummaryCell
                label="Outstanding"
                value={`GHC ${formatGHC(statement.outstanding)}`}
                tone={statement.outstanding > 0 ? "danger" : "muted"}
              />
            </>
          ) : (
            <>
              <SummaryCell label="Verified" value={`GHC ${formatGHC(statement.verifiedTotal)}`} />
              <SummaryCell label="Paid out" value={`GHC ${formatGHC(statement.paidOutTotal)}`} />
              <SummaryCell label="Entries" value={String(rows.length)} />
            </>
          )}
        </View>

        <Text style={styles.previewLabel}>
          {rows.length} {rows.length === 1 ? "entry" : "entries"}
        </Text>
        <View style={styles.preview}>
          {rows.slice(0, 8).map((row, index) => (
            <View key={`${row.round}-${index}`} style={styles.previewRow}>
              <Text style={styles.previewRound}>R{row.round}</Text>
              {!memberMode ? (
                <Text style={styles.previewMember} numberOfLines={1}>{row.member}</Text>
              ) : (
                <Text style={styles.previewMember} numberOfLines={1}>{row.type}</Text>
              )}
              <Text style={styles.previewAmount}>{formatGHC(row.amount)}</Text>
              <Text style={styles.previewStatus}>{row.status}</Text>
            </View>
          ))}
          {rows.length > 8 ? (
            <Text style={styles.previewMore}>+{rows.length - 8} more rows in the export</Text>
          ) : null}
        </View>

        <TouchableOpacity style={styles.primaryBtn} onPress={onShare}>
          {format === "csv" ? (
            copied ? <Check size={18} color={colors.onGold} /> : <Copy size={18} color={colors.onGold} />
          ) : (
            <Share2 size={18} color={colors.onGold} />
          )}
          <Text style={styles.primaryBtnText}>
            {format === "csv"
              ? copied
                ? "Copied"
                : "Copy CSV"
              : "Share statement"}
          </Text>
        </TouchableOpacity>

        <View style={styles.noteRow}>
          <FileText size={13} color={colors.textMuted} />
          <Text style={styles.note}>
            {format === "csv"
              ? `Saved as ${fileName}`
              : "A plain statement you can send on WhatsApp or read out at the meeting."}
          </Text>
        </View>
      </ScrollView>
    </BottomSheet>
  );
}

function SummaryCell({ label, value, tone = "plain" }) {
  return (
    <View style={styles.summaryCell}>
      <Text
        style={[
          styles.summaryValue,
          tone === "danger" && { color: colors.danger },
          tone === "muted" && { color: colors.textMuted },
        ]}
      >
        {value}
      </Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 20, paddingBottom: 60, gap: 6 },
  groupName: { color: colors.text, fontSize: 18, fontWeight: "800", marginBottom: 4 },
  label: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginTop: 12,
    marginBottom: 8,
  },
  chipRow: { flexDirection: "row", gap: 8 },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipActive: { backgroundColor: colors.gold, borderColor: colors.gold },
  chipText: { color: colors.textMuted, fontSize: 12, fontWeight: "700" },
  chipTextActive: { color: colors.onGold },
  summary: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    paddingVertical: 14,
    marginTop: 16,
  },
  summaryCell: { flex: 1, alignItems: "center", gap: 4 },
  summaryValue: { color: colors.text, fontSize: 15, fontWeight: "800" },
  summaryLabel: { color: colors.textMuted, fontSize: 11 },
  previewLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginTop: 18,
    marginBottom: 8,
  },
  preview: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: 12,
  },
  previewRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 5 },
  previewRound: { color: colors.gold, fontSize: 11, fontWeight: "800", width: 26 },
  previewMember: { color: colors.textBody, fontSize: 12, flex: 1 },
  previewAmount: { color: colors.text, fontSize: 12, fontWeight: "700" },
  previewStatus: { color: colors.textMuted, fontSize: 10, width: 74, textAlign: "right" },
  previewMore: { color: colors.textMuted, fontSize: 11, marginTop: 8 },
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
  primaryBtnText: { color: colors.onGold, fontSize: 16, fontWeight: "700" },
  noteRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 12 },
  note: { color: colors.textMuted, fontSize: 11, flex: 1 },
});