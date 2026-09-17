import {useLocalSearchParams} from "expo-router";
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ActivityCard from "../../components/molecule/ActivityCard";
import BottomSheet from "../../components/molecule/BottomSheet";
import { useState } from "react";
import { useTabBarStore } from "../../store/tabBar";
import { ChevronLeft, MoreVertical, Receipt, Plus } from "lucide-react-native";
import { useRouter } from "expo-router";

const initialBills = [
    { id: "1", title: "Dinner", amount: "45.00 GHC", receipientName: "Jane Smith", receipientEmail: "jane.smith@example.com", senderName: "John Doe", initialStatus: "pay" },
    { id: "2", title: "Groceries", amount: "120.00 GHC", receipientName: "Kofi", receipientEmail: "kofi@example.com", senderName: "John Doe", initialStatus: "request" },
    { id: "3", title: "Transport", amount: "30.00 GHC", receipientName: "Ama", receipientEmail: "ama@example.com", senderName: "Jane Smith", initialStatus: "paid" },
];

const groupNames = {
  "1": "Roommates",
  "2": "Trip to Bali",
  "3": "Office Lunch",
  "4": "Family Expenses",
};

const groupInfos = {
  "1": { description: "Monthly rent, utilities, and shared groceries", category: "Roommates", members: 4, created: "Jan 2024" },
  "2": { description: "Flights, accommodation, and activities for Bali trip", category: "Travel", members: 6, created: "Mar 2024" },
  "3": { description: "Daily lunch orders and team snacks", category: "Food & Dining", members: 8, created: "Feb 2024" },
  "4": { description: "Family vacation and household expenses", category: "Family", members: 5, created: "Dec 2023" },
};

export default function GroupDetails() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [bills, setBills] = useState(initialBills);
  const [isPaymentVisible, setPaymentVisible] = useState(false);
  const [paymentCard, setPaymentCard] = useState(null);
  const [isKebabVisible, setKebabVisible] = useState(false);
  const [isCreateExpenseVisible, setCreateExpenseVisible] = useState(false);
  const [activeTab, setActiveTab] = useState("expenses");
  const { setMode, setCustomButtons } = useTabBarStore();

  const groupName = groupNames[id] || "Group";
  const groupInfo = groupInfos[id] || { description: "", category: "Other", members: 1, created: "Now" };

  const tabs = ["expenses", "balances", "totals", "info"];

  const handlePayPress = (card) => {
    setPaymentCard(card);
    setPaymentVisible(true);
    setMode('custom');
    setCustomButtons([
      { label: 'Cancel', variant: 'cancel', onPress: () => { setPaymentVisible(false); setPaymentCard(null); setMode('tabs'); setCustomButtons([]); } },
      { label: 'Pay Now', variant: 'primary', onPress: () => {
        setBills(prev => prev.map(a => a.id === card.id ? { ...a, initialStatus: 'paid' } : a));
        setPaymentVisible(false);
        setPaymentCard(null);
        setMode('tabs');
        setCustomButtons([]);
      } },
    ]);
  };

  const handlePaymentClose = () => {
    setPaymentVisible(false);
    setPaymentCard(null);
    setMode('tabs');
    setCustomButtons([]);
  };

  const handleCreateExpense = () => {
    setCreateExpenseVisible(true);
    setMode("custom");
    setCustomButtons([
      { label: "Cancel", variant: "cancel", onPress: () => { setCreateExpenseVisible(false); setMode("tabs"); setCustomButtons([]); } },
      { label: "Create", variant: "primary", onPress: () => { setCreateExpenseVisible(false); setMode("tabs"); setCustomButtons([]); } },
    ]);
  };

  const handleCreateExpenseClose = () => {
    setCreateExpenseVisible(false);
    setMode("tabs");
    setCustomButtons([]);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Group header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <ChevronLeft size={24} color="#fbb81c" />
          </TouchableOpacity>
          <Text style={styles.groupName}>{groupName}</Text>
          <TouchableOpacity style={styles.kebabBtn} onPress={() => setKebabVisible(true)}>
            <MoreVertical size={24} color="#fbb81c" />
          </TouchableOpacity>
        </View>

        {/* Tab Pills */}
        <View style={styles.tabPills}>
          {tabs.map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[
                styles.tabPill,
                activeTab === tab && styles.tabPillActive,
              ]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[
                styles.tabPillText,
                activeTab === tab && styles.tabPillTextActive,
              ]}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {activeTab === "expenses" && (
          <FlatList
            data={bills}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
                <ActivityCard
                    title={item.title}
                    amount={item.amount}
                    receipientName={item.receipientName}
                    receipientEmail={item.receipientEmail}
                    senderName={item.senderName}
                    initialStatus={item.initialStatus}
                    onPayPress={handlePayPress}
                />
            )}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <View style={styles.emptyIconWrapper}>
                  <Receipt size={64} color="#33353b" />
                </View>
                <Text style={styles.emptyTitle}>No expenses yet</Text>
                <Text style={styles.emptySubtitle}>Expenses added to this group will appear here</Text>
                <TouchableOpacity style={styles.emptyActionBtn} onPress={() => { /* TODO: add expense */ }}>
                  <Plus size={20} color="#16171b" />
                  <Text style={styles.emptyActionText}>Add Expense</Text>
                </TouchableOpacity>
              </View>
            }
        />
        )}

        {activeTab === "balances" && (
          <View style={styles.tabContent}>
            <Text style={styles.tabContentTitle}>Balances</Text>
            <Text style={styles.tabContentSubtitle}>Balance summary will be shown here</Text>
            {/* TODO: Add balance calculations per member */}
          </View>
        )}

        {activeTab === "totals" && (
          <View style={styles.tabContent}>
            <Text style={styles.tabContentTitle}>Totals</Text>
            <Text style={styles.tabContentSubtitle}>Total expenses and statistics</Text>
            {/* TODO: Add totals calculations */}
          </View>
        )}

        {activeTab === "info" && (
          <ScrollView contentContainerStyle={styles.infoContent}>
            <View style={styles.infoSection}>
              <Text style={styles.infoSectionTitle}>About this group</Text>
              <Text style={styles.infoText}>{groupInfo.description || "No description provided"}</Text>
            </View>

            <View style={styles.infoSection}>
              <Text style={styles.infoSectionTitle}>Details</Text>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Category</Text>
                <Text style={styles.infoValue}>{groupInfo.category}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Members</Text>
                <Text style={styles.infoValue}>{groupInfo.members} people</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Created</Text>
                <Text style={styles.infoValue}>{groupInfo.created}</Text>
              </View>
            </View>

            <View style={styles.infoSection}>
              <Text style={styles.infoSectionTitle}>Members</Text>
              <Text style={styles.infoText}>Member list and management coming soon</Text>
            </View>
          </ScrollView>
        )}

        {isKebabVisible && (
            <BottomSheet
              isVisible={isKebabVisible}
              onClose={() => setKebabVisible(false)}
              title="Group Actions"
            >
              <View style={styles.kebabSheetContent}>
                <TouchableOpacity style={styles.kebabItem} onPress={() => { /* TODO: edit group */ setKebabVisible(false); }}>
                  <Text style={styles.kebabItemText}>Edit Group</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.kebabItem} onPress={() => { /* TODO: manage members */ setKebabVisible(false); }}>
                  <Text style={styles.kebabItemText}>Manage Members</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.kebabItem} onPress={() => { /* TODO: view analytics */ setKebabVisible(false); }}>
                  <Text style={styles.kebabItemText}>View Analytics</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.kebabItem, styles.kebabItemDanger]} onPress={() => { /* TODO: delete group */ setKebabVisible(false); }}>
                  <Text style={styles.kebabItemTextDanger}>Delete Group</Text>
                </TouchableOpacity>
              </View>
            </BottomSheet>
          )}

        {paymentCard && (
            <BottomSheet
                isVisible={isPaymentVisible}
                onClose={handlePaymentClose}
                title="Pay"
            >
                <View style={styles.paymentSheetContent}>
                    <View style={styles.divider} />

                    <Text style={styles.paymentLabel}>Amount</Text>
                    <Text style={styles.paymentAmount}>{paymentCard.amount}</Text>

                    <View style={styles.payToRow}>
                        <Text style={styles.payToLabel}>Pay to</Text>
                        <View style={styles.payToLine} />
                    </View>

                    <View style={styles.receiverRow}>
                        <View style={styles.receiverAvatar}>
                            <Text style={styles.receiverAvatarText}>
                                {(paymentCard.receipientName || 'R').charAt(0)}
                            </Text>
                        </View>
                        <View style={styles.receiverInfo}>
                            <Text style={styles.receiverName}>{paymentCard.receipientName || 'Receiver'}</Text>
                            <Text style={styles.receiverEmail}>{paymentCard.receipientEmail || 'receiver@example.com'}</Text>
                        </View>
                    </View>

                    <View style={styles.divider} />
                </View>
</BottomSheet>
        )}

        <TouchableOpacity style={styles.fab} onPress={handleCreateExpense}>
          <Plus size={28} color="#16171b" />
        </TouchableOpacity>

        <BottomSheet
          isVisible={isCreateExpenseVisible}
          onClose={handleCreateExpenseClose}
          title="Add Expense"
        >
          <View style={styles.createExpenseSheetContent}>
            <Text style={styles.createExpenseSheetText}>Expense creation form will go here</Text>
          </View>
        </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#16171b', paddingHorizontal: 16 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2b30',
  },
  backBtn: { padding: 8 },
  kebabBtn: { padding: 8 },
  groupName: { color: '#fbb81c', fontSize: 24, fontWeight: 'bold', textAlign: 'center', flex: 1 },
  list: { flex: 1, marginTop: 16 },
  kebabSheetContent: { paddingVertical: 20 },
  kebabItem: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2b30',
  },
  kebabItemDanger: { borderBottomWidth: 0 },
  kebabItemText: { color: '#ffffff', fontSize: 16, fontWeight: '500' },
  kebabItemTextDanger: { color: '#ff6b6b', fontSize: 16, fontWeight: '500' },
  paymentSheetContent: {
      paddingHorizontal: 20,
      paddingBottom: 84,
  },
  divider: {
      height: 1,
      backgroundColor: '#33353b',
      marginVertical: 16,
  },
  paymentLabel: {
      color: '#8e8e93',
      fontSize: 14,
      fontWeight: '600',
  },
  paymentAmount: {
      color: '#ffffff',
      fontSize: 30,
      fontWeight: 'bold',
      marginVertical: 4,
  },
  payToRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 18,
  },
  payToLabel: {
      color: '#8e8e93',
      fontSize: 14,
      fontWeight: '600',
      marginRight: 10,
  },
  payToLine: {
      flex: 1,
      height: 1,
      backgroundColor: '#33353b',
  },
  receiverRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 16,
  },
  receiverAvatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: '#fbb81c',
      justifyContent: 'center',
      alignItems: 'center',
  },
  receiverAvatarText: {
      color: '#16171b',
      fontSize: 16,
      fontWeight: 'bold',
  },
  receiverInfo: {
      marginLeft: 14,
      flex: 1,
  },
  receiverName: {
      color: '#ffffff',
      fontSize: 16,
      fontWeight: '600',
  },
  receiverEmail: {
      color: '#8e8e93',
      fontSize: 13,
      marginTop: 3,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingTop: 60,
  },
  emptyIconWrapper: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#1e1f24',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySubtitle: {
    color: '#8e8e93',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  emptyActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fbb81c',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
  },
  emptyActionText: {
    color: '#16171b',
    fontSize: 16,
    fontWeight: '600',
  },
  tabPills: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2b30',
  },
  tabPill: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#2a2b30',
    alignItems: 'center',
  },
  tabPillActive: {
    backgroundColor: '#fbb81c',
  },
  tabPillText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  tabPillTextActive: {
    color: '#16171b',
  },
  tabContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingTop: 60,
  },
  tabContentTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  tabContentSubtitle: {
    color: '#8e8e93',
    fontSize: 14,
    textAlign: 'center',
  },
  infoContent: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40, gap: 20 },
  infoSection: { gap: 12 },
  infoSectionTitle: { color: '#fbb81c', fontSize: 14, fontWeight: '600', textTransform: 'uppercase' },
  infoText: { color: '#ffffff', fontSize: 15, lineHeight: 22 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#2a2b30' },
  infoLabel: { color: '#8e8e93', fontSize: 15 },
  infoValue: { color: '#ffffff', fontSize: 15, fontWeight: '500' },
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
  createExpenseSheetContent: { paddingVertical: 20, alignItems: "center" },
  createExpenseSheetText: { color: "#8e8e93", fontSize: 16 },
});