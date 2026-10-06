/**
 * Start a group, on the server.
 *
 * The form asks for four things because the API accepts four
 * things. There is deliberately no roster editor: a membership
 * points at a real account, so the only person this form can
 * seat in the rotation is the person holding the phone.
 * Everyone else arrives by redeeming the invite code the
 * server returns — a create form that collected names would be
 * asking the server to seat people who never agreed to it (I51,
 * P-S1).
 *
 * The amount is parsed to integer pesewas by `toPesewas`, which
 * throws on a float or on more than two decimals rather than
 * rounding — the same rule the server applies, so an amount that
 * looks valid here is valid there.
 */

import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ChevronLeft, Info } from "lucide-react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "../../services/api";
import { toPesewas } from "../../services/money";
import { mutations } from "../../services/query";
import { DAY_NAMES } from "../../services/susu";
import colors from "../../theme/colors";

const DAY_LABELS = DAY_NAMES;

export default function CreateSusu() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const create = useMutation(mutations.createGroup(queryClient));

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [targetAmount, setTargetAmount] = useState("200");
  const [collectionDay, setCollectionDay] = useState(1);
  const [error, setError] = useState(null);

  /**
   * The server is the only thing that can start a group, so the
   * button is disabled while it decides. A retry that succeeded
   * twice would be two groups; the mutation is never retried
   * automatically (writes are not, in `services/query.js`).
   */
  const onCreate = () => {
    setError(null);

    const cleanedName = name.trim();
    if (!cleanedName) {
      setError("Give the group a name.");
      return;
    }

    let targetPesewas;
    try {
      targetPesewas = toPesewas(targetAmount.trim());
    } catch (parseError) {
      setError(parseError.message);
      return;
    }
    if (targetPesewas <= 0) {
      setError("The pot must be more than zero.");
      return;
    }

    create.mutate(
      {
        name: cleanedName,
        description: description.trim(),
        targetPesewas,
        collectionDay,
      },
      {
        onSuccess: (group) => {
          // The response is the group with its invite code, and the
          // first round opens on first read — so the round screen is
          // where a new admin lands, one tap from the code they share.
          router.replace(`/susu/round?id=${group.id}`);
        },
        onError: (err) => {
          setError(
            err instanceof ApiError ? err.message : "The group could not be created."
          );
        },
      }
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ChevronLeft size={24} color={colors.gold} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Susu Group</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.tip}>
          <Info size={16} color={colors.gold} />
          <Text style={styles.tipText}>
            Everyone pays the pot weekly and takes the full amount in turn. You are
            seated as the admin at the first turn; everyone else joins with the
            invite code you get back.
          </Text>
        </View>

        <Text style={styles.label}>Group name *</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Market Association Susu"
          placeholderTextColor={colors.placeholder}
          value={name}
          onChangeText={setName}
          maxLength={50}
        />

        <Text style={styles.label}>What is this group saving for?</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          placeholder="Optional — e.g. school fees for the kids"
          placeholderTextColor={colors.placeholder}
          value={description}
          onChangeText={setDescription}
          multiline
          maxLength={160}
        />

        <Text style={styles.label}>Pot per round (GHC) *</Text>
        <TextInput
          style={styles.input}
          placeholder="200"
          placeholderTextColor={colors.placeholder}
          value={targetAmount}
          onChangeText={(text) => setTargetAmount(text.replace(/[^0-9.]/g, ""))}
          keyboardType="decimal-pad"
        />
        <Text style={styles.hint}>
          What every member pays each week, and what the receiver collects.
        </Text>

        <Text style={styles.label}>Collection day</Text>
        <View style={styles.dayRow}>
          {DAY_LABELS.map((label, index) => {
            const day = index + 1;
            const selected = collectionDay === day;
            return (
              <TouchableOpacity
                key={label}
                style={[styles.dayChip, selected && styles.dayChipSelected]}
                onPress={() => setCollectionDay(day)}
              >
                <Text style={[styles.dayChipText, selected && styles.dayChipTextSelected]}>
                  {label.slice(0, 2)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <Text style={styles.hint}>
          The round closes at the end of this day each week.
        </Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.submit, create.isPending && styles.submitDisabled]}
          disabled={create.isPending}
          onPress={onCreate}
        >
          <Text style={styles.submitText}>
            {create.isPending ? "Creating…" : "Create Susu Group"}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  headerTitle: { color: colors.text, fontSize: 20, fontWeight: "700" },
  backBtn: { padding: 4, width: 40 },
  body: { padding: 20, paddingBottom: 60 },
  tip: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderLeftWidth: 3,
    borderLeftColor: colors.gold,
    padding: 14,
    marginBottom: 10,
  },
  tipText: { flex: 1, color: colors.textBody, fontSize: 13, lineHeight: 19 },
  label: { color: colors.text, fontSize: 14, fontWeight: "600", marginTop: 8 },
  input: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 14,
    color: colors.text,
    fontSize: 15,
  },
  multiline: { minHeight: 80, textAlignVertical: "top" },
  hint: { color: colors.textMuted, fontSize: 12, lineHeight: 18, marginTop: 6 },
  dayRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  dayChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.surfaceAlt,
  },
  dayChipSelected: { borderColor: colors.gold, backgroundColor: colors.goldSoft },
  dayChipText: { color: colors.textMuted, fontSize: 13, fontWeight: "700" },
  dayChipTextSelected: { color: colors.gold },
  error: { color: colors.danger, fontSize: 13, marginTop: 8 },
  submit: {
    backgroundColor: colors.gold,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 16,
  },
  submitDisabled: { opacity: 0.6 },
  submitText: { color: colors.background, fontSize: 16, fontWeight: "700" },
});
