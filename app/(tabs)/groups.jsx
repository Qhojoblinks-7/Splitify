import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, FlatList, Pressable, TextInput, Image, KeyboardAvoidingView, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Plus, Users, ChevronRight, Search, MoreVertical, ChevronLeft, Camera, X, Tag, CheckCircle2, UserPlus } from "lucide-react-native";
import { useRouter } from "expo-router";
import { useTabBarStore } from "../../store/tabBar";
import BottomSheet from "../../components/molecule/BottomSheet";

const PREDEFINED_CATEGORIES = [
  "Roommates", "Travel", "Food & Dining", "Shopping", "Entertainment",
  "Utilities", "Transportation", "Health & Fitness", "Education", "Family",
  "Friends", "Work", "Events", "Other"
];

const initialContacts = [
  { id: "1", name: "Ama Boateng", handle: "@amab", initials: "AB", phone: "+233 244 123 4567", email: "ama@splitify.com", status: "online", avatarColor: "#fbb81c" },
  { id: "2", name: "John Doe", handle: "@johnd", initials: "JD", phone: "+233 244 987 6543", email: "john@splitify.com", status: "offline", avatarColor: "#3b82f6" },
  { id: "3", name: "Emily Davis", handle: "@emilyd", initials: "ED", phone: "+233 244 555 1234", email: "emily@splitify.com", status: "online", avatarColor: "#10b981" },
  { id: "4", name: "Kofi Mensah", handle: "@kofim", initials: "KM", phone: "+233 244 555 9876", email: "kofi@splitify.com", status: "offline", avatarColor: "#f97316" },
  { id: "5", name: "Sarah Johnson", handle: "@sarahj", initials: "SJ", phone: "+233 244 555 4321", email: "sarah@splitify.com", status: "online", avatarColor: "#8b5cf6" },
  { id: "6", name: "Michael Brown", handle: "@michaelb", initials: "MB", phone: "+233 244 555 8765", email: "michael@splitify.com", status: "offline", avatarColor: "#ec4899" },
  { id: "7", name: "Fatima Al-Hassan", handle: "@fatima", initials: "FA", phone: "+233 244 555 2468", email: "fatima@splitify.com", status: "online", avatarColor: "#06b6d4" },
  { id: "8", name: "Kwame Asante", handle: "@kwamea", initials: "KA", phone: "+233 244 555 1357", email: "kwame@splitify.com", status: "offline", avatarColor: "#84cc16" },
  { id: "9", name: "Ama Aboagye", handle: "@amaa", initials: "AA", phone: "+233 244 555 2468", email: "amaa@splitify.com", status: "online", avatarColor: "#f97316" },
  { id: "10", name: "Daniel Osei", handle: "@danielo", initials: "DO", phone: "+233 244 555 1111", email: "daniel@splitify.com", status: "offline", avatarColor: "#3b82f6" },
];

const initialGroups = [
  { id: "1", name: "Roommates", memberCount: 4, totalExpenses: "1,250.00 GHC", color: "#fbb81c", lastActivity: "2 hours ago" },
  { id: "2", name: "Trip to Bali", memberCount: 6, totalExpenses: "3,450.00 GHC", color: "#3b82f6", lastActivity: "1 day ago" },
  { id: "3", name: "Office Lunch", memberCount: 8, totalExpenses: "890.00 GHC", color: "#10b981", lastActivity: "3 days ago" },
  { id: "4", name: "Family Expenses", memberCount: 5, totalExpenses: "2,100.00 GHC", color: "#f97316", lastActivity: "1 week ago" },
];

export default function GroupsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [groups, setGroups] = useState(initialGroups);
  const [isCreateVisible, setCreateVisible] = useState(false);
  const [isAddMembersVisible, setAddMembersVisible] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [groupImage, setGroupImage] = useState(null);
  const [groupTitle, setGroupTitle] = useState("");
  const [groupDescription, setGroupDescription] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [customCategory, setCustomCategory] = useState("");
  const [selectedContacts, setSelectedContacts] = useState([]);
  const { setMode, setCustomButtons } = useTabBarStore();

  const filteredGroups = groups.filter((group) =>
    group.name.toLowerCase().includes(searchText.toLowerCase())
  );

  const navigateToGroup = (groupId) => {
    router.push(`/group/${groupId}`);
  };

  const handleCreateGroup = () => {
    setGroupImage(null);
    setGroupTitle("");
    setGroupDescription("");
    setSelectedCategory("");
    setCustomCategory("");
    setSelectedContacts([]);
    setCreateVisible(true);
    setMode("custom");
    setCustomButtons([
      { label: "Cancel", variant: "cancel", onPress: () => { setCreateVisible(false); setMode("tabs"); setCustomButtons([]); } },
      { label: "Continue", variant: "primary", onPress: () => {
          if (groupTitle.trim()) {
            setCreateVisible(false);
            setAddMembersVisible(true);
            setCustomButtons([
              { label: "Skip", variant: "cancel", onPress: () => { 
                  createGroupWithMembers([]);
                  setAddMembersVisible(false); 
                  setMode("tabs"); 
                  setCustomButtons([]); 
                } },
              { label: "Add Members", variant: "primary", onPress: () => {
                  createGroupWithMembers(selectedContacts);
                  setAddMembersVisible(false);
                  setMode("tabs");
                  setCustomButtons([]);
                } },
            ]);
          }
        } },
    ]);
  };

  const createGroupWithMembers = (members) => {
    const newGroup = {
      id: String(Date.now()),
      name: groupTitle,
      memberCount: 1 + members.length,
      totalExpenses: "0.00 GHC",
      color: "#fbb81c",
      lastActivity: "Just now",
    };
    setGroups(prev => [newGroup, ...prev]);
  };

  const handleCreateClose = () => {
    setCreateVisible(false);
    setMode("tabs");
    setCustomButtons([]);
  };

  const handleAddMembersClose = () => {
    setAddMembersVisible(false);
    setMode("tabs");
    setCustomButtons([]);
  };

  const toggleContactSelection = (contactId) => {
    setSelectedContacts(prev => 
      prev.includes(contactId) 
        ? prev.filter(id => id !== contactId)
        : [...prev, contactId]
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ChevronLeft size={24} color="#fbb81c" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Groups</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchInputWrapper}>
          <Search size={20} color="#8e8e93" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search groups..."
            value={searchText}
            onChangeText={setSearchText}
            placeholderTextColor="#8e8e93"
          />
        </View>
      </View>

      <FlatList
        data={filteredGroups}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.groupCard} onPress={() => navigateToGroup(item.id)} activeOpacity={0.8}>
            <View style={[styles.groupAvatar, { backgroundColor: item.color }]}>
              <Users size={24} color="#16171b" />
            </View>
            <View style={styles.groupInfo}>
              <Text style={styles.groupName}>{item.name}</Text>
              <View style={styles.groupMeta}>
                <Text style={styles.groupMetaText}>{item.memberCount} members</Text>
                <View style={styles.dot} />
                <Text style={styles.groupMetaText}>{item.totalExpenses}</Text>
              </View>
              <Text style={styles.lastActivity}>{item.lastActivity}</Text>
            </View>
            <ChevronRight size={20} color="#8e8e93" />
          </TouchableOpacity>
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />

      {filteredGroups.length === 0 && (
        <View style={styles.emptyState}>
          <Users size={64} color="#33353b" />
          <Text style={styles.emptyTitle}>No groups found</Text>
          <Text style={styles.emptySubtitle}>Create a group to start splitting expenses</Text>
        </View>
      )}

      <TouchableOpacity style={styles.fab} onPress={handleCreateGroup}>
        <Plus size={28} color="#16171b" />
      </TouchableOpacity>

      <BottomSheet
        isVisible={isCreateVisible}
        onClose={handleCreateClose}
        title="Create New Group"
      >
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.createSheetContent} keyboardVerticalOffset={100}>
          <ScrollView contentContainerStyle={styles.createSheetScrollContent} showsVerticalScrollIndicator={false}>
            {/* Image Upload */}
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>Group Photo</Text>
              <TouchableOpacity style={[styles.imageUploadBtn, groupImage && styles.imageUploadBtnHasImage]} onPress={() => {
                // TODO: Implement image picker
                setGroupImage("https://via.placeholder.com/400x200"); // Placeholder
              }}>
                {groupImage ? (
                  <Image source={{ uri: groupImage }} style={styles.groupImage} />
                ) : (
                  <>
                    <Camera size={32} color="#fbb81c" />
                    <Text style={styles.imageUploadText}>Add Group Photo</Text>
                  </>
                )}
                {groupImage && (
                  <TouchableOpacity style={styles.removeImageBtn} onPress={(e) => { e.stopPropagation(); setGroupImage(null); }}>
                    <X size={16} color="#ffffff" />
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            </View>

            {/* Group Title */}
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>Group Title *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Enter group name"
                value={groupTitle}
                onChangeText={setGroupTitle}
                placeholderTextColor="#8e8e93"
                maxLength={50}
              />
            </View>

            {/* Description */}
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>Description</Text>
              <TextInput
                style={[styles.textInput, styles.textInputMultiline]}
                placeholder="Add a description (optional)"
                value={groupDescription}
                onChangeText={setGroupDescription}
                placeholderTextColor="#8e8e93"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                maxLength={200}
              />
            </View>

            {/* Categories */}
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>Category</Text>
              
              {/* Predefined Categories */}
              <View style={styles.categorySection}>
                <Text style={styles.categorySectionTitle}>Predefined</Text>
                <View style={styles.categoryGrid}>
                  {PREDEFINED_CATEGORIES.map((cat) => (
                    <TouchableOpacity
                      key={cat}
                      style={[
                        styles.categoryChip,
                        selectedCategory === cat && styles.categoryChipSelected
                      ]}
                      onPress={() => {
                        setSelectedCategory(cat);
                        setCustomCategory("");
                      }}
                    >
                      <Text style={[
                        styles.categoryChipText,
                        selectedCategory === cat && styles.categoryChipTextSelected
                      ]}>
                        {cat}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Custom Category */}
              <View style={styles.categorySection}>
                <Text style={styles.categorySectionTitle}>Custom</Text>
                <View style={styles.customCategoryInputWrapper}>
                  <Tag size={20} color="#fbb81c" style={styles.customCategoryIcon} />
                  <TextInput
                    style={[styles.textInput, styles.customCategoryInput]}
                    placeholder="Or create your own category"
                    value={customCategory}
                    onChangeText={(text) => {
                      setCustomCategory(text);
                      if (text.trim()) setSelectedCategory("");
                    }}
                    placeholderTextColor="#8e8e93"
                    maxLength={30}
                  />
                </View>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </BottomSheet>

      <BottomSheet
        isVisible={isAddMembersVisible}
        onClose={handleAddMembersClose}
        title="Add Members"
      >
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.addMembersSheetContent} keyboardVerticalOffset={100}>
          <FlatList
            data={initialContacts}
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
                    {isSelected && (
                      <View style={styles.contactCheckOverlay}>
                        <CheckCircle2 size={20} color="#fbb81c" />
                      </View>
                    )}
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
            ListHeaderComponent={
              <View style={styles.addMembersHeader}>
                <Text style={styles.addMembersSubtitle}>Select contacts to add to "{groupTitle}"</Text>
                
                {/* Selected Contacts Horizontal List */}
                {selectedContacts.length > 0 && (
                  <View style={styles.selectedContactsContainer}>
                    <Text style={styles.selectedContactsLabel}>{selectedContacts.length} selected</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.selectedContactsScroll}>
                      {selectedContacts.map((contactId) => {
                        const contact = initialContacts.find(c => c.id === contactId);
                        return contact ? (
                          <TouchableOpacity
                            key={contact.id}
                            style={styles.selectedContactAvatar}
                            onPress={() => toggleContactSelection(contact.id)}
                          >
                            <View style={[styles.selectedContactAvatarInner, { backgroundColor: contact.avatarColor }]}>
                              <Text style={styles.contactAvatarText}>{contact.initials}</Text>
                            </View>
                            <View style={styles.selectedContactRemove}>
                              <X size={12} color="#ffffff" />
                            </View>
                          </TouchableOpacity>
                        ) : null;
                      })}
                    </ScrollView>
                  </View>
                )}
              </View>
            }
          />
        </KeyboardAvoidingView>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#16171b" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#2a2b30",
  },
  headerTitle: { color: "#ffffff", fontSize: 24, fontWeight: "bold" },
  backBtn: { padding: 8 },
  headerSpacer: { width: 40 },
  searchContainer: { paddingHorizontal: 20, paddingVertical: 16 },
  searchInputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2a2b30",
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 48,
  },
  searchIcon: { marginRight: 10 },
  searchInput: { flex: 1, color: "#ffffff", fontSize: 16 },
  groupCard: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "#1e1f24",
  },
  groupAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  groupInfo: { flex: 1 },
  groupName: { color: "#ffffff", fontSize: 17, fontWeight: "600" },
  groupMeta: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  groupMetaText: { color: "#8e8e93", fontSize: 13 },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: "#33353b", marginHorizontal: 8 },
  lastActivity: { color: "#5a5a5e", fontSize: 12, marginTop: 2 },
  separator: { height: 1, backgroundColor: "#2a2b30", marginLeft: 88 },
  listContent: { paddingBottom: 100 },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  emptyTitle: { color: "#ffffff", fontSize: 18, fontWeight: "600", marginTop: 16 },
  emptySubtitle: { color: "#8e8e93", fontSize: 14, textAlign: "center", marginTop: 8 },
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
  createSheetContent: { paddingVertical: 20, width: "100%" },
  createSheetText: { color: "#8e8e93", fontSize: 16 },
  createSheetScrollContent: { paddingHorizontal: 20, width: "100%", gap: 20 },
  imageUploadContainer: { width: "100%" },
  imageUploadBtn: {
    width: "100%",
    aspectRatio: 2,
    borderRadius: 12,
    backgroundColor: "#2a2b30",
    borderWidth: 1,
    borderColor: "#33353b",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    overflow: "hidden",
  },
  imageUploadBtnHasImage: {
    borderColor: "#fbb81c",
    borderWidth: 2,
  },
  groupImage: { width: "100%", height: "100%", borderRadius: 12 },
  imageUploadText: { color: "#fbb81c", fontSize: 13, fontWeight: "600" },
  removeImageBtn: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255, 107, 107, 0.9)",
    justifyContent: "center",
    alignItems: "center",
  },
  fieldContainer: { width: "100%", gap: 8 },
  fieldLabel: { color: "#ffffff", fontSize: 14, fontWeight: "600" },
  textInput: {
    backgroundColor: "#2a2b30",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: "#ffffff",
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#33353b",
    width: "100%",
  },
  textInputMultiline: { minHeight: 100, paddingTop: 14 },
  categorySection: { gap: 12 },
  categorySectionTitle: { color: "#8e8e93", fontSize: 13, fontWeight: "600", textTransform: "uppercase" },
  categoryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  categoryChip: {
    backgroundColor: "#2a2b30",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#33353b",
  },
  categoryChipSelected: {
    backgroundColor: "#fbb81c",
    borderColor: "#fbb81c",
  },
  categoryChipText: { color: "#ffffff", fontSize: 13, fontWeight: "500" },
  categoryChipTextSelected: { color: "#16171b" },
  customCategoryInputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2a2b30",
    borderRadius: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "#33353b",
    gap: 10,
    width: "100%",
  },
  customCategoryIcon: { marginRight: 4 },
  customCategoryInput: { flex: 1, paddingVertical: 14, backgroundColor: "transparent" },
  addMembersSubtitle: { color: "#8e8e93", fontSize: 14, marginBottom: 8, textAlign: "center" },
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 4,
  },
  contactAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
    position: "relative",
  },
  contactAvatarText: { color: "#16171b", fontSize: 16, fontWeight: "bold", zIndex: 1 },
  contactCheckOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 24,
    backgroundColor: "rgba(22, 23, 27, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 2,
  },
  contactInfo: { flex: 1 },
  contactName: { color: "#ffffff", fontSize: 16, fontWeight: "600" },
  contactHandle: { color: "#8e8e93", fontSize: 13, marginTop: 2 },
  contactUnselectedCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#33353b",
  },
  contactSeparator: { height: 1, backgroundColor: "#2a2b30", marginLeft: 62 },
  selectedContactsContainer: { marginBottom: 16 },
  selectedContactsLabel: { color: "#8e8e93", fontSize: 13, fontWeight: "600", marginBottom: 8 },
  selectedContactsScroll: { gap: 8, paddingBottom: 4 },
  selectedContactAvatar: { position: "relative" },
  selectedContactAvatarInner: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  selectedContactRemove: {
    position: "absolute",
    top: -4,
    right: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#ff6b6b",
    justifyContent: "center",
    alignItems: "center",
  },
  addMembersSheetContent: { flex: 1, width: "100%" },
  addMembersHeader: { paddingHorizontal: 20, paddingBottom: 16 },
});

