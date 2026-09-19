import React, { useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronLeft, UserPlus, X, CheckCircle2 } from "lucide-react-native";
import BottomSheet from "../../components/molecule/BottomSheet";
import { groupMembers } from "../../services/groupData";

const allContacts = [
  { id: "1", name: "John Doe", handle: "@johnd", initials: "JD", phone: "+233 244 987 6543", email: "john@splitify.com", status: "offline", avatarColor: "#fbb81c" },
  { id: "2", name: "Jane Smith", handle: "@janes", initials: "JS", phone: "+233 244 555 1234", email: "jane.smith@example.com", status: "online", avatarColor: "#3b82f6" },
  { id: "3", name: "Mike Wilson", handle: "@mikew", initials: "MW", phone: "+233 244 555 9876", email: "mikew@example.com", status: "offline", avatarColor: "#10b981" },
  { id: "4", name: "Sarah Johnson", handle: "@sarahj", initials: "SJ", phone: "+233 244 555 4321", email: "sarahj@example.com", status: "online", avatarColor: "#8b5cf6" },
  { id: "5", name: "Emily Davis", handle: "@emilyd", initials: "ED", phone: "+233 244 555 1234", email: "emily@splitify.com", status: "online", avatarColor: "#ec4899" },
  { id: "6", name: "Kofi Mensah", handle: "@kofim", initials: "KM", phone: "+233 244 555 9876", email: "kofi@splitify.com", status: "offline", avatarColor: "#06b6d4" },
  { id: "7", name: "Fatima Al-Hassan", handle: "@fatima", initials: "FA", phone: "+233 244 555 2468", email: "fatima@splitify.com", status: "online", avatarColor: "#f97316" },
  { id: "8", name: "Kwame Asante", handle: "@kwamea", initials: "KA", phone: "+233 244 555 1357", email: "kwame@splitify.com", status: "offline", avatarColor: "#84cc16" },
  { id: "9", name: "Ama Aboagye", handle: "@amaa", initials: "AA", phone: "+233 244 555 2468", email: "amaa@splitify.com", status: "online", avatarColor: "#f97316" },
  { id: "10", name: "Daniel Osei", handle: "@danielo", initials: "DO", phone: "+233 244 555 1111", email: "daniel@splitify.com", status: "offline", avatarColor: "#3b82f6" },
];

const groupNameMap = {
  "1": "Roommates",
  "2": "Trip to Bali",
  "3": "Office Lunch",
  "4": "Family Expenses",
};

export default function ManageMembersScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [members, setMembers] = useState(groupMembers[id] || []);
  const [isAddVisible, setAddVisible] = useState(false);
  const [selectedContacts, setSelectedContacts] = useState([]);

  const currentGroupName = groupNameMap[id] || "Group";

  const handleRemoveMember = (memberId) => {
    setMembers((prev) => prev.filter((m) => m.id !== memberId));
  };

  const handleAddMembers = () => {
    const currentIds = new Set(members.map((m) => m.id));
    const newMembers = selectedContacts
      .filter((contactId) => !currentIds.has(contactId))
      .map((contactId) => {
        const contact = allContacts.find((c) => c.id === contactId);
        return {
          id: contact.id,
          name: contact.name,
          handle: contact.handle,
          initials: contact.initials,
          avatarColor: contact.avatarColor,
          role: "Member",
        };
      });
    setMembers((prev) => [...prev, ...newMembers]);
    setSelectedContacts([]);
    setAddVisible(false);
  };

  const toggleContactSelection = (contactId) => {
    setSelectedContacts((prev) =>
      prev.includes(contactId)
        ? prev.filter((cid) => cid !== contactId)
        : [...prev, contactId]
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ChevronLeft size={24} color="#fbb81c" />
        </TouchableOpacity>
        <Text style={styles.title}>Manage Members</Text>
        <View style={styles.headerSpacer} />
      </View>

      <Text style={styles.groupName}>{currentGroupName}</Text>
      <Text style={styles.subtitle}>{members.length} members</Text>

      <FlatList
        data={members}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.memberRow}>
            <View style={[styles.memberAvatar, { backgroundColor: item.avatarColor }]}>
              <Text style={styles.memberAvatarText}>{item.initials}</Text>
            </View>
            <View style={styles.memberInfo}>
              <Text style={styles.memberName}>{item.name}</Text>
              <Text style={styles.memberHandle}>{item.handle}</Text>
            </View>
            <View style={styles.memberRole}>
              <View style={[styles.roleBadge, item.role === "Admin" && styles.roleBadgeAdmin]}>
                <Text style={[styles.roleBadgeText, item.role === "Admin" && styles.roleBadgeTextAdmin]}>
                  {item.role}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.removeBtn}
              onPress={() => handleRemoveMember(item.id)}
              accessibilityLabel={`Remove ${item.name}`}
            >
              <X size={18} color="#ff6b6b" />
            </TouchableOpacity>
          </View>
        )}
        ItemSeparatorComponent={() => <View style={styles.memberSeparator} />}
        contentContainerStyle={styles.memberList}
        ListEmptyComponent={
          <View style={styles.emptyMembers}>
            <Text style={styles.emptyMembersText}>No members in this group</Text>
          </View>
        }
      />

      <TouchableOpacity style={styles.fab} onPress={() => { setAddVisible(true); setSelectedContacts([]); }}>
        <UserPlus size={28} color="#16171b" />
      </TouchableOpacity>

      <BottomSheet
        isVisible={isAddVisible}
        onClose={() => { setAddVisible(false); setSelectedContacts([]); }}
        title="Add Members"
      >
        <View style={styles.addSheetContent}>
          {selectedContacts.length > 0 && (
            <View style={styles.selectedBar}>
              <Text style={styles.selectedCount}>{selectedContacts.length} selected</Text>
              <TouchableOpacity
                style={styles.clearSelectedBtn}
                onPress={() => setSelectedContacts([])}
              >
                <Text style={styles.clearSelectedText}>Clear</Text>
              </TouchableOpacity>
            </View>
          )}
          <FlatList
            data={allContacts.filter((c) => !members.some((m) => m.id === c.id))}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => {
              const isSelected = selectedContacts.includes(item.id);
              return (
                <TouchableOpacity
                  style={styles.contactRow}
                  onPress={() => toggleContactSelection(item.id)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.contactAvatar, { backgroundColor: item.avatarColor }]}>
                    <Text style={styles.contactAvatarText}>{item.initials}</Text>
                  </View>
                  <View style={styles.contactInfo}>
                    <Text style={styles.contactName}>{item.name}</Text>
                    <Text style={styles.contactHandle}>{item.handle}</Text>
                  </View>
                  {isSelected ? (
                    <CheckCircle2 size={24} color="#fbb81c" />
                  ) : (
                    <View style={styles.contactUnselectedCircle} />
                  )}
                </TouchableOpacity>
              );
            }}
            ItemSeparatorComponent={() => <View style={styles.contactSeparator} />}
            contentContainerStyle={{ paddingBottom: 40 }}
          />
          <View style={styles.addSheetButtons}>
            <TouchableOpacity
              style={styles.addSheetCancelBtn}
              onPress={() => { setAddVisible(false); setSelectedContacts([]); }}
            >
              <Text style={styles.addSheetCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.addSheetAddBtn, selectedContacts.length === 0 && styles.addSheetAddBtnDisabled]}
              onPress={handleAddMembers}
              disabled={selectedContacts.length === 0}
            >
              <Text style={styles.addSheetAddText}>Add</Text>
            </TouchableOpacity>
          </View>
        </View>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#16171b",
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#2a2b30",
  },
  backBtn: { padding: 8 },
  title: {
    color: "#ffffff",
    fontSize: 24,
    fontWeight: "bold",
    flex: 1,
    textAlign: "center",
  },
  headerSpacer: { width: 40 },
  groupName: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "600",
    marginVertical: 16,
    textAlign: "center",
  },
  subtitle: {
    color: "#8e8e93",
    fontSize: 14,
    marginBottom: 16,
    textAlign: "center",
  },
  memberList: { paddingBottom: 80 },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingRight: 8,
  },
  memberAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  memberAvatarText: {
    color: "#16171b",
    fontSize: 15,
    fontWeight: "bold",
  },
  memberInfo: { flex: 1 },
  memberName: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
  memberHandle: {
    color: "#8e8e93",
    fontSize: 13,
    marginTop: 2,
  },
  memberRole: { marginLeft: 12 },
  roleBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: "#2a2b30",
  },
  roleBadgeAdmin: {
    backgroundColor: "#fbb81c",
  },
  roleBadgeText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "600",
  },
  roleBadgeTextAdmin: {
    color: "#16171b",
  },
  removeBtn: {
    padding: 8,
  },
  memberSeparator: {
    height: 1,
    backgroundColor: "#2a2b30",
    marginLeft: 58,
  },
  emptyMembers: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 60,
  },
  emptyMembersText: {
    color: "#8e8e93",
    fontSize: 16,
  },
  fab: {
    position: "absolute",
    bottom: 32,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#fbb81c",
    justifyContent: "center",
    alignItems: "center",
  },
  addSheetContent: {},
  selectedBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#2a2b30",
  },
  selectedCount: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
  },
  clearSelectedBtn: {
    padding: 4,
  },
  clearSelectedText: {
    color: "#8e8e93",
    fontSize: 14,
    fontWeight: "600",
  },
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 4,
  },
  contactAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  contactAvatarText: {
    color: "#16171b",
    fontSize: 14,
    fontWeight: "bold",
  },
  contactInfo: { flex: 1 },
  contactName: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
  contactHandle: {
    color: "#8e8e93",
    fontSize: 13,
    marginTop: 2,
  },
  contactUnselectedCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#33353b",
  },
  contactSeparator: {
    height: 1,
    backgroundColor: "#2a2b30",
    marginLeft: 62,
  },
  addSheetButtons: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: "#2a2b30",
  },
  addSheetCancelBtn: {
    flex: 1,
    paddingVertical: 16,
    backgroundColor: "#2a2b30",
    borderRadius: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#33353b",
  },
  addSheetCancelText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
  addSheetAddBtn: {
    flex: 1,
    paddingVertical: 16,
    backgroundColor: "#fbb81c",
    borderRadius: 16,
    alignItems: "center",
  },
  addSheetAddBtnDisabled: {
    opacity: 0.5,
  },
  addSheetAddText: {
    color: "#16171b",
    fontSize: 16,
    fontWeight: "bold",
  },
});
