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
import SusuCreateForm from "../../components/molecule/SusuCreateForm";
import { useSusuStore } from "../../store/susu";
import { validateGroupDraft, roundTarget, DAY_NAMES } from "../../services/susu";

const emptyMember = () => ({ name: "", phone: "", mobileMoney: "" });

export default function CreateSusu() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const createGroup = useSusuStore((s) => s.createGroup);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [targetAmount, setTargetAmount] = useState("200");
  const [collectionDay, setCollectionDay] = useState(1);
  const [members, setMembers] = useState([emptyMember()]);
  const [error, setError] = useState(null);

  const suggested = roundTarget(members.length + 1) * 2;

  const onCreate = () => {
    const cleaned = members
      .filter((m) => m.name.trim())
      .map((m) => ({ ...m, name: m.name.trim(), phone: m.phone.trim() }));

    const result = validateGroupDraft({ name, description, targetAmount, members: cleaned });
    if (!result.ok) {
      setError(result.message);
      return;
    }

    const id = createGroup({
      name,
      description,
      targetAmount,
      collectionDay,
      totalRounds: cleaned.length + 1,
      members: cleaned,
    });
    router.replace(`/susu/${id}`);
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ChevronLeft size={24} color="#fbb81c" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Susu Group</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.tip}>
          <Info size={16} color="#fbb81c" />
          <Text style={styles.tipText}>
            Everyone pays the pot weekly and takes the full amount in turn. Verified contributions
            trigger the payout automatically.
          </Text>
        </View>

        <Text style={styles.label}>Group name *</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Market Association Susu"
          placeholderTextColor="#666666"
          value={name}
          onChangeText={setName}
          maxLength={50}
        />

        <Text style={styles.label}>What is this group saving for?</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          placeholder="Optional — e.g. school fees for the kids"
          placeholderTextColor="#666666"
          value={description}
          onChangeText={setDescription}
          multiline
          maxLength={160}
        />

        <TouchableOpacity style={styles.suggestion} onPress={() => setTargetAmount(String(suggested))}>
          <Text style={styles.suggestionText}>Use GHC {suggested} based on {members.length + 1} members</Text>
        </TouchableOpacity>

        <SusuCreateForm
          members={members}
          onMembersChange={setMembers}
          targetAmount={targetAmount}
          onTargetAmountChange={setTargetAmount}
          collectionDay={collectionDay}
          onCollectionDayChange={setCollectionDay}
          DAY_NAMES={DAY_NAMES}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity style={styles.submit} onPress={onCreate}>
          <Text style={styles.submitText}>Create Susu Group</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#16171b" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#2a2b30",
  },
  headerTitle: { color: "#ffffff", fontSize: 20, fontWeight: "700" },
  backBtn: { padding: 4, width: 40 },
  body: { padding: 20, paddingBottom: 60 },
  tip: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: "#1e1f24",
    borderRadius: 14,
    borderLeftWidth: 3,
    borderLeftColor: "#fbb81c",
    padding: 14,
    marginBottom: 10,
  },
  tipText: { flex: 1, color: "#c9c9ce", fontSize: 13, lineHeight: 19 },
  label: { color: "#ffffff", fontSize: 14, fontWeight: "600", marginTop: 8 },
  input: {
    backgroundColor: "#222327",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#33353b",
    paddingHorizontal: 14,
    paddingVertical: 14,
    color: "#ffffff",
    fontSize: 15,
  },
  multiline: { minHeight: 80, textAlignVertical: "top" },
  suggestion: { alignSelf: "flex-start", paddingVertical: 6 },
  suggestionText: { color: "#fbb81c", fontSize: 12, fontWeight: "600" },
  error: { color: "#ef4444", fontSize: 13, marginTop: 8 },
  submit: {
    backgroundColor: "#fbb81c",
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 16,
  },
  submitText: { color: "#16171b", fontSize: 16, fontWeight: "700" },
});