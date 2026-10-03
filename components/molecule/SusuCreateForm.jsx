import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView } from "react-native";
import { Search, UserPlus, Trash2, X, Users } from "lucide-react-native";
import { searchDirectory } from "../../services/directory";

const emptyMember = () => ({ name: "", phone: "", mobileMoney: "" });

export default function SusuCreateForm({ members, onMembersChange, targetAmount, onTargetAmountChange, collectionDay, onCollectionDayChange, DAY_NAMES }) {
  const [query, setQuery] = useState("");

  const results = useMemo(
    () => searchDirectory(query, { excludePhones: members.map((m) => m.phone) }),
    [query, members]
  );

  const addFromDirectory = (person) => {
    onMembersChange([...members, { name: person.name, phone: person.phone, mobileMoney: "" }]);
    setQuery("");
  };

  const addManually = () => onMembersChange([...members, emptyMember()]);

  const updateMember = (index, patch) => {
    onMembersChange(members.map((m, i) => (i === index ? { ...m, ...patch } : m)));
  };

  const removeMember = (index) => {
    onMembersChange(members.length === 1 ? [emptyMember()] : members.filter((_, i) => i !== index));
  };

  const filled = members.filter((m) => m.name.trim()).length + 1;

  return (
    <View style={styles.wrap}>
      <View style={styles.sectionHeader}>
        <Text style={styles.label}>Members *</Text>
        <Text style={styles.hint}>{filled} in rotation</Text>
      </View>

      <View style={styles.searchWrap}>
        <Search size={18} color="#8e8e93" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name or phone number"
          placeholderTextColor="#666666"
          value={query}
          onChangeText={setQuery}
        />
        {query ? (
          <TouchableOpacity onPress={() => setQuery("")}>
            <X size={18} color="#8e8e93" />
          </TouchableOpacity>
        ) : null}
      </View>

      {query ? (
        <ScrollView style={styles.results} nestedScrollEnabled keyboardShouldPersistTaps="handled">
          {results.length === 0 ? (
            <Text style={styles.noResults}>Nobody found for "{query}".</Text>
          ) : (
            results.map((person) => (
              <TouchableOpacity key={person.id} style={styles.resultRow} onPress={() => addFromDirectory(person)}>
                <View style={[styles.resultAvatar, { backgroundColor: person.avatarColor }]}>
                  <Text style={styles.resultInitials}>{person.initials}</Text>
                </View>
                <View style={styles.resultInfo}>
                  <Text style={styles.resultName}>{person.name}</Text>
                  <Text style={styles.resultPhone}>{person.phone}</Text>
                </View>
                <UserPlus size={18} color="#fbb81c" />
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      ) : null}

      <Text style={styles.label}>Pot per round (GHC) *</Text>
      <TextInput
        style={styles.input}
        placeholder="200"
        placeholderTextColor="#666666"
        value={targetAmount}
        onChangeText={(text) => onTargetAmountChange(text.replace(/[^0-9.]/g, ""))}
        keyboardType="decimal-pad"
      />

      <Text style={styles.label}>Collection day *</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayRow}>
        {DAY_NAMES.map((day, index) => (
          <TouchableOpacity
            key={day}
            style={[styles.dayChip, collectionDay === index && styles.dayChipActive]}
            onPress={() => onCollectionDayChange(index)}
          >
            <Text style={[styles.dayText, collectionDay === index && styles.dayTextActive]}>
              {day.slice(0, 3)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <Text style={styles.hint}>Members contribute each {DAY_NAMES[collectionDay]}.</Text>

      {members.map((member, index) => (
        <View key={index} style={styles.memberCard}>
          <View style={styles.positionBadge}>
            <Text style={styles.positionText}>{index + 2}</Text>
          </View>
          <View style={styles.memberFields}>
            <TextInput
              style={styles.input}
              placeholder="Full name"
              placeholderTextColor="#666666"
              value={member.name}
              onChangeText={(text) => updateMember(index, { name: text })}
              maxLength={40}
            />
            <TextInput
              style={styles.input}
              placeholder="Mobile number"
              placeholderTextColor="#666666"
              value={member.phone}
              onChangeText={(text) => updateMember(index, { phone: text })}
              keyboardType="phone-pad"
            />
          </View>
          <TouchableOpacity style={styles.removeBtn} onPress={() => removeMember(index)}>
            <Trash2 size={18} color="#ef4444" />
          </TouchableOpacity>
        </View>
      ))}

      <TouchableOpacity style={styles.addBtn} onPress={addManually}>
        <UserPlus size={18} color="#fbb81c" />
        <Text style={styles.addBtnText}>Add someone not in your contacts</Text>
      </TouchableOpacity>

      <View style={styles.rotationPreview}>
        <Users size={14} color="#8e8e93" />
        <Text style={styles.rotationText}>
          Rotation: You → {members.filter((m) => m.name.trim()).map((m) => m.name).join(" → ") || "…"}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  sectionHeader: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
  label: { color: "#ffffff", fontSize: 14, fontWeight: "600", marginTop: 8 },
  hint: { color: "#8e8e93", fontSize: 12, marginTop: 8 },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#222327",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#33353b",
    paddingHorizontal: 12,
    height: 46,
  },
  searchInput: { flex: 1, color: "#ffffff", fontSize: 15 },
  results: { maxHeight: 220, backgroundColor: "#1e1f24", borderRadius: 14, borderWidth: 1, borderColor: "#2a2b30" },
  resultRow: { flexDirection: "row", alignItems: "center", padding: 12, gap: 10 },
  resultAvatar: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  resultInitials: { color: "#16171b", fontSize: 13, fontWeight: "800" },
  resultInfo: { flex: 1 },
  resultName: { color: "#ffffff", fontSize: 15, fontWeight: "600" },
  resultPhone: { color: "#8e8e93", fontSize: 12, marginTop: 2 },
  noResults: { color: "#8e8e93", fontSize: 13, padding: 14 },
  input: {
    backgroundColor: "#222327",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#33353b",
    paddingHorizontal: 14,
    paddingVertical: 13,
    color: "#ffffff",
    fontSize: 15,
  },
  dayRow: { gap: 8, paddingVertical: 4 },
  dayChip: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#33353b",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  dayChipActive: { backgroundColor: "#fbb81c", borderColor: "#fbb81c" },
  dayText: { color: "#ffffff", fontSize: 13, fontWeight: "600" },
  dayTextActive: { color: "#16171b" },
  memberCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#1e1f24",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#2a2b30",
  },
  positionBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#2a2b30",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
    marginTop: 10,
  },
  positionText: { color: "#fbb81c", fontSize: 12, fontWeight: "800" },
  memberFields: { flex: 1, gap: 8 },
  removeBtn: { padding: 8, marginTop: 6 },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#fbb81c",
    paddingVertical: 14,
    marginTop: 4,
  },
  addBtnText: { color: "#fbb81c", fontSize: 14, fontWeight: "600" },
  rotationPreview: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  rotationText: { color: "#8e8e93", fontSize: 12, flex: 1 },
});