import React, { useState, useRef } from "react";
import { View, Text, StyleSheet, SectionList, TouchableOpacity, TextInput } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Users, ChevronLeft, Search, Plus } from "lucide-react-native";
import { useRouter } from "expo-router";
import { useTabBarStore } from "../../store/tabBar";
import ContactCard from "../../components/molecule/ContactCard";

const initialContacts = [
  { id: "1", name: "Ama Boateng", handle: "@amab", initials: "AB", phone: "+233 244 123 4567", email: "ama@splitify.com", status: "online" },
  { id: "2", name: "John Doe", handle: "@johnd", initials: "JD", phone: "+233 244 987 6543", email: "john@splitify.com", status: "offline" },
  { id: "3", name: "Emily Davis", handle: "@emilyd", initials: "ED", phone: "+233 244 555 1234", email: "emily@splitify.com", status: "online" },
  { id: "4", name: "Kofi Mensah", handle: "@kofim", initials: "KM", phone: "+233 244 555 9876", email: "kofi@splitify.com", status: "offline" },
  { id: "5", name: "Sarah Johnson", handle: "@sarahj", initials: "SJ", phone: "+233 244 555 4321", email: "sarah@splitify.com", status: "online" },
  { id: "6", name: "Michael Brown", handle: "@michaelb", initials: "MB", phone: "+233 244 555 8765", email: "michael@splitify.com", status: "offline" },
  { id: "7", name: "Fatima Al-Hassan", handle: "@fatima", initials: "FA", phone: "+233 244 555 2468", email: "fatima@splitify.com", status: "online" },
  { id: "8", name: "Kwame Asante", handle: "@kwamea", initials: "KA", phone: "+233 244 555 1357", email: "kwame@splitify.com", status: "offline" },
  { id: "9", name: "Ama Aboagye", handle: "@amaa", initials: "AA", phone: "+233 244 555 2468", email: "amaa@splitify.com", status: "online" },
  { id: "10", name: "Daniel Osei", handle: "@danielo", initials: "DO", phone: "+233 244 555 1111", email: "daniel@splitify.com", status: "offline" },
];

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

const getGroupedContacts = (contacts) => {
  const sorted = [...contacts].sort((a, b) => a.name.localeCompare(b.name));
  const groups = {};
  sorted.forEach((c) => {
    const letter = c.name[0].toUpperCase();
    if (!groups[letter]) groups[letter] = [];
    groups[letter].push(c);
  });
  return Object.keys(groups)
    .sort()
    .map((letter) => ({ title: letter, data: groups[letter] }));
};

export default function ContactsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [contacts] = useState(initialContacts);
  const [searchText, setSearchText] = useState("");
  const [activeLetter, setActiveLetter] = useState(null);
  const sectionListRef = useRef(null);
  const { setMode, setCustomButtons } = useTabBarStore();

  const filteredContacts = contacts.filter(
    (c) =>
      c.name.toLowerCase().includes(searchText.toLowerCase()) ||
      c.handle.toLowerCase().includes(searchText.toLowerCase()) ||
      c.phone.toLowerCase().includes(searchText.toLowerCase())
  );

  const groupedContacts = getGroupedContacts(filteredContacts);

  const handlePressContact = (contact) => {
    const balanceMap = { "2": "45.00", "4": "120.50", "6": "30.00" };
    const balance = balanceMap[contact.id] || "";
    router.push({
      pathname: "/ContactProfile",
      params: {
        id: contact.id,
        name: contact.name,
        handle: contact.handle,
        initials: contact.initials,
        phone: contact.phone,
        email: contact.email,
        balance,
      },
    });
  };

  const handleAddContact = () => {
    setMode("custom");
    setCustomButtons([
      { label: "Cancel", variant: "cancel", onPress: () => { setMode("tabs"); setCustomButtons([]); } },
      { label: "Add", variant: "primary", onPress: () => { setMode("tabs"); setCustomButtons([]); } },
    ]);
  };

  const scrollToLetter = (letter) => {
    const sectionIndex = groupedContacts.findIndex((g) => g.title === letter);
    if (sectionIndex >= 0 && sectionListRef.current) {
      sectionListRef.current.scrollToLocation({
        sectionIndex,
        itemIndex: 0,
        animated: true,
      });
    }
    setActiveLetter(letter);
    setTimeout(() => setActiveLetter(null), 600);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ChevronLeft size={24} color="#fbb81c" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Contacts</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchInputWrapper}>
          <Search size={20} color="#8e8e93" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search contacts..."
            value={searchText}
            onChangeText={setSearchText}
            placeholderTextColor="#8e8e93"
          />
        </View>
      </View>

      <View style={styles.listContainer}>
        <SectionList
          ref={sectionListRef}
          sections={groupedContacts}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ContactCard
              name={item.name}
              handle={item.handle}
              initials={item.initials}
              onPress={() => handlePressContact(item)}
            />
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          style={styles.sectionList}
        />

        {filteredContacts.length === 0 && (
          <View style={styles.emptyState}>
            <Users size={64} color="#33353b" />
            <Text style={styles.emptyTitle}>No contacts found</Text>
            <Text style={styles.emptySubtitle}>Add a contact to get started</Text>
          </View>
        )}

        <View style={styles.alphabetBar}>
          {ALPHABET.map((letter) => (
            <TouchableOpacity
              key={letter}
              style={styles.alphabetItem}
              onPress={() => scrollToLetter(letter)}
              activeOpacity={0.6}
            >
              <Text style={styles.alphabetText}>{letter}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <TouchableOpacity style={styles.fab} onPress={handleAddContact}>
        <Plus size={28} color="#16171b" />
      </TouchableOpacity>

      {activeLetter && (
        <View style={styles.letterOverlay}>
          <Text style={styles.letterOverlayText}>{activeLetter}</Text>
        </View>
      )}
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
  listContainer: { flex: 1 },
  sectionList: { flex: 1 },
  listContent: { paddingBottom: 200, paddingRight: 30 },
  separator: { height: 1, backgroundColor: "#2a2b30", marginLeft: 88 },
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
    shadowColor: "#fbb81c",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  alphabetBar: {
    position: "absolute",
    right: 2,
    top: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
  },
  alphabetItem: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  alphabetText: {
    color: "#fbb81c",
    fontSize: 9,
    fontWeight: "600",
    textAlign: "center",
  },
  letterOverlay: {
    position: "absolute",
    top: "40%",
    left: "45%",
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(22,23,27,0.8)",
    justifyContent: "center",
    alignItems: "center",
  },
  letterOverlayText: {
    color: "#fbb81c",
    fontSize: 32,
    fontWeight: "bold",
  },
});
