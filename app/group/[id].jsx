import {useLocalSearchParams} from "expo-router";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ScrollView } from "react-native";
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ActivityCard from "../../components/molecule/ActivityCard";
import BottomSheet from "../../components/molecule/BottomSheet";
import { useState, useEffect } from "react";
import { useTabBarStore } from "../../store/tabBar";
import { ChevronLeft, MoreVertical, Receipt, Plus, UserPlus } from "lucide-react-native";
import { useRouter } from "expo-router";
import { fetchGroupBills } from "../../services/api";

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

const groupMembers = {
  "1": [
    { id: "1", name: "John Doe", handle: "@johnd", initials: "JD", avatarColor: "#fbb81c", role: "Admin" },
    { id: "2", name: "Jane Smith", handle: "@janes", initials: "JS", avatarColor: "#3b82f6", role: "Member" },
    { id: "3", name: "Mike Wilson", handle: "@mikew", initials: "MW", avatarColor: "#10b981", role: "Member" },
    { id: "4", name: "Sarah Johnson", handle: "@sarahj", initials: "SJ", avatarColor: "#8b5cf6", role: "Member" },
  ],
  "2": [
    { id: "1", name: "John Doe", handle: "@johnd", initials: "JD", avatarColor: "#fbb81c", role: "Admin" },
    { id: "5", name: "Emily Davis", handle: "@emilyd", initials: "ED", avatarColor: "#ec4899", role: "Member" },
    { id: "6", name: "Kofi Mensah", handle: "@kofim", initials: "KM", avatarColor: "#06b6d4", role: "Member" },
    { id: "7", name: "Fatima Al-Hassan", handle: "@fatima", initials: "FA", avatarColor: "#f97316", role: "Member" },
    { id: "8", name: "Kwame Asante", handle: "@kwamea", initials: "KA", avatarColor: "#84cc16", role: "Member" },
    { id: "9", name: "Ama Aboagye", handle: "@amaa", initials: "AA", avatarColor: "#f97316", role: "Member" },
  ],
  "3": [
    { id: "1", name: "John Doe", handle: "@johnd", initials: "JD", avatarColor: "#fbb81c", role: "Admin" },
    { id: "2", name: "Jane Smith", handle: "@janes", initials: "JS", avatarColor: "#3b82f6", role: "Member" },
    { id: "3", name: "Mike Wilson", handle: "@mikew", initials: "MW", avatarColor: "#10b981", role: "Member" },
    { id: "4", name: "Sarah Johnson", handle: "@sarahj", initials: "SJ", avatarColor: "#8b5cf6", role: "Member" },
    { id: "5", name: "Emily Davis", handle: "@emilyd", initials: "ED", avatarColor: "#ec4899", role: "Member" },
    { id: "6", name: "Kofi Mensah", handle: "@kofim", initials: "KM", avatarColor: "#06b6d4", role: "Member" },
    { id: "7", name: "Fatima Al-Hassan", handle: "@fatima", initials: "FA", avatarColor: "#f97316", role: "Member" },
    { id: "8", name: "Kwame Asante", handle: "@kwamea", initials: "KA", avatarColor: "#84cc16", role: "Member" },
  ],
  "4": [
    { id: "1", name: "John Doe", handle: "@johnd", initials: "JD", avatarColor: "#fbb81c", role: "Admin" },
    { id: "2", name: "Jane Smith", handle: "@janes", initials: "JS", avatarColor: "#3b82f6", role: "Member" },
    { id: "4", name: "Sarah Johnson", handle: "@sarahj", initials: "SJ", avatarColor: "#8b5cf6", role: "Member" },
    { id: "9", name: "Ama Aboagye", handle: "@amaa", initials: "AA", avatarColor: "#f97316", role: "Member" },
    { id: "10", name: "Daniel Osei", handle: "@danielo", initials: "DO", avatarColor: "#3b82f6", role: "Member" },
  ],
};

export default function GroupDetails() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [bills, setBills] = useState([]);
  const [billsLoading, setBillsLoading] = useState(true);
  const [billsError, setBillsError] = useState(false);
  const [totalsPeriod, setTotalsPeriod] = useState("All");
  const [isPaymentVisible, setPaymentVisible] = useState(false);
  const [paymentCard, setPaymentCard] = useState(null);
  const [isKebabVisible, setKebabVisible] = useState(false);
  const [isCreateExpenseVisible, setCreateExpenseVisible] = useState(false);
  const [activeTab, setActiveTab] = useState("expenses");
  const { setMode, setCustomButtons } = useTabBarStore();

  useEffect(() => {
    let cancelled = false;
    setBillsLoading(true);
    setBillsError(false);
    fetchGroupBills(id)
      .then((data) => {
        if (!cancelled) {
          setBills(data);
          setBillsLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setBillsError(true);
          setBillsLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [id]);

  const groupName = groupNames[id] || "Group";
  const groupInfo = groupInfos[id] || { description: "", category: "Other", members: 1, created: "Now" };
  const members = groupMembers[id] || [];

  const tabs = ["expenses", "balances", "totals", "info"];

  const currentUser = "John Doe";

  const formatBarAmount = (val) => {
    const n = Number(val) || 0;
    const sign = n < 0 ? "-" : "+";
    return `${sign}\u20B5${Math.abs(n).toFixed(2)}`;
  };

  const parseAmount = (amt) => {
    const n = parseFloat((amt || "0").replace(/[^0-9.\-]/g, ""));
    return isNaN(n) ? 0 : n;
  };

  const computeBalances = () => {
    const balances = {};
    members.forEach((m) => { balances[m.name] = 0; });
    if (!balances[currentUser]) balances[currentUser] = 0;

    bills.forEach((bill) => {
      const amount = parseAmount(bill.amount);
      if (bill.initialStatus === "pay") {
        // current user owes the recipient
        balances[bill.receipientName] = (balances[bill.receipientName] || 0) + amount;
        balances[currentUser] = (balances[currentUser] || 0) - amount;
      } else if (bill.initialStatus === "request") {
        // sender owes the current user
        balances[bill.senderName] = (balances[bill.senderName] || 0) - amount;
        balances[currentUser] = (balances[currentUser] || 0) + amount;
      }
      // 'paid' => settled, no outstanding balance
    });

    return balances;
  };

  const balances = computeBalances();
  const entries = Object.entries(balances)
    .map(([name, net]) => ({ name, net }))
    .filter((e) => e.net !== 0)
    .sort((a, b) => Math.abs(b.net) - Math.abs(a.net));
  const outstandingBills = bills.filter((bill) => bill.initialStatus !== "paid");
  const maxAbs = Math.max(...entries.map((e) => Math.abs(e.net)), 1);

  const totalsPeriods = ["All", "1D", "1W", "4W", "3M", "1Y"];

  const totalGroupSpending = bills.reduce(
    (sum, bill) => sum + parseAmount(bill.amount),
    0
  );
  const totalYouPaid = bills
    .filter((bill) => bill.senderName === currentUser)
    .reduce((sum, bill) => sum + parseAmount(bill.amount), 0);
  const yourTotalShare = bills
    .filter((bill) => bill.receipientName === currentUser)
    .reduce((sum, bill) => sum + parseAmount(bill.amount), 0);

  const formatTotal = (val) => {
    const n = Number(val) || 0;
    return `\u20B5${n.toFixed(2)}`;
  };

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
          billsLoading ? (
            <View style={styles.centeredContent}>
              <Text style={styles.emptyBalances}>Loading balances...</Text>
            </View>
          ) : billsError ? (
            <View style={styles.centeredContent}>
              <Text style={styles.emptyBalances}>Couldn't load balances</Text>
            </View>
          ) : entries.length === 0 ? (
            <View style={styles.centeredContent}>
              <Text style={styles.emptyBalances}>All settled up!</Text>
            </View>
          ) : (
            <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.tabContent}>
              <View style={styles.chartContainer}>
                {entries.map((entry) => {
                  const isOwing = entry.net < 0;
                  const pct = Math.max(
                    (Math.abs(entry.net) / maxAbs) * 100,
                    30
                  );
                  const amountStr = formatBarAmount(entry.net);
                  const barMinWidth = Math.ceil(amountStr.length * 8) + 24;
                  const isYou = entry.name === currentUser;
                  return (
                    <View key={entry.name} style={styles.barRow}>
                      {isOwing ? (
                        <>
                          <View style={styles.barSide}>
                            <View
                              style={[
                                styles.bar,
                                styles.barRed,
                                { width: `${pct}%`, minWidth: barMinWidth },
                              ]}
                            >
                              <Text style={[styles.barAmountIn, styles.barAmountInOwe]} numberOfLines={1}>
                                {formatBarAmount(entry.net)}
                              </Text>
                            </View>
                          </View>
                          <View style={styles.centerLine} />
                          <View style={[styles.barSide, styles.barLabelSide]}>
                            <Text
                              style={[styles.barName, isYou && styles.barNameYou]}
                              numberOfLines={1}
                            >
                              {entry.name}
                              {isYou ? " (you)" : ""}
                            </Text>
                          </View>
                        </>
                      ) : (
                        <>
                          <View style={[styles.barSide, styles.barLabelSide]}>
                            <Text
                              style={[styles.barName, isYou && styles.barNameYou]}
                              numberOfLines={1}
                            >
                              {entry.name}
                              {isYou ? " (you)" : ""}
                            </Text>
                          </View>
                          <View style={styles.centerLine} />
                          <View style={styles.barSide}>
                            <View
                              style={[
                                styles.bar,
                                styles.barGreen,
                                { width: `${pct}%`, minWidth: barMinWidth },
                              ]}
                            >
                              <Text style={styles.barAmountIn} numberOfLines={1}>
                                {formatBarAmount(entry.net)}
                              </Text>
                            </View>
                          </View>
                        </>
                      )}
                    </View>
                  );
                })}
              </View>

              <View style={{ marginTop: 24 }}>
              {outstandingBills.map((bill) => (
                <ActivityCard
                  key={bill.id}
                  title={bill.title}
                  amount={bill.amount}
                  receipientName={bill.receipientName}
                  receipientEmail={bill.receipientEmail}
                  senderName={bill.senderName}
                  initialStatus={bill.initialStatus}
                  onPayPress={handlePayPress}
                />
              ))}
              </View>
            </ScrollView>
          )
        )}

        {activeTab === "totals" && (
            <View style={[styles.tabContent, { flex: 1 }]}>
             <View style={styles.totalsPills}>
               {totalsPeriods.map((period) => (
                 <TouchableOpacity
                   key={period}
                   style={[
                     styles.totalsPill,
                     totalsPeriod === period && styles.totalsPillActive,
                   ]}
                   onPress={() => setTotalsPeriod(period)}
                 >
                   <Text
                     style={[
                       styles.totalsPillText,
                       totalsPeriod === period && styles.totalsPillTextActive,
                     ]}
                   >
                     {period}
                   </Text>
                 </TouchableOpacity>
               ))}
             </View>

             <View style={styles.totalsCard}>
               <Text style={styles.totalsCardTitle}>Total group spending</Text>
               <Text style={styles.totalsCardAmount}>{formatTotal(totalGroupSpending)}</Text>
             </View>

             <View style={styles.totalsCard}>
               <Text style={styles.totalsCardTitle}>Total you paid for</Text>
               <Text style={styles.totalsCardAmount}>{formatTotal(totalYouPaid)}</Text>
             </View>

             <View style={styles.totalsCard}>
               <Text style={styles.totalsCardTitle}>Your total share</Text>
               <Text style={styles.totalsCardAmount}>{formatTotal(yourTotalShare)}</Text>
             </View>
           </View>
        )}

        {activeTab === "info" && (
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
                  <View style={[
                    styles.roleBadge,
                    item.role === "Admin" && styles.roleBadgeAdmin,
                  ]}>
                    <Text style={[
                      styles.roleBadgeText,
                      item.role === "Admin" && styles.roleBadgeTextAdmin,
                    ]}>
                      {item.role}
                    </Text>
                  </View>
                </View>
              </View>
            )}
            ItemSeparatorComponent={() => <View style={styles.memberSeparator} />}
            ListHeaderComponent={
              <View style={styles.infoContent}>
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
                  <View style={styles.infoSectionHeader}>
                    <Text style={styles.infoSectionTitle}>Members</Text>
                    <TouchableOpacity style={styles.addMemberBtn}>
                      <UserPlus size={18} color="#fbb81c" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            }
            ListFooterComponentStyle={styles.memberListHeader}
          />
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
      marginBottom: 8,
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
     paddingHorizontal: 0,
   },
   centeredContent: {
     flex: 1,
     justifyContent: 'center',
     alignItems: 'center',
     paddingHorizontal: 16,
   },
   totalsPills: {
     flexDirection: 'row',
     gap: 8,
     paddingHorizontal: 16,
     paddingBottom: 16,
   },
   totalsPill: {
     paddingHorizontal: 14,
     paddingVertical: 8,
     borderRadius: 20,
     backgroundColor: '#2a2b30',
     alignItems: 'center',
     justifyContent: 'center',
   },
   totalsPillActive: {
     backgroundColor: '#fbb81c',
   },
   totalsPillText: {
     color: '#ffffff',
     fontSize: 13,
     fontWeight: '600',
   },
   totalsPillTextActive: {
     color: '#16171b',
   },
   totalsCard: {
     backgroundColor: '#222327',
     borderRadius: 12,
     padding: 16,
     marginHorizontal: 16,
     marginBottom: 12,
     borderWidth: 1,
     borderColor: '#33353b',
   },
   totalsCardTitle: {
     color: '#8e8e93',
     fontSize: 13,
     fontWeight: '600',
     textTransform: 'uppercase',
     marginBottom: 4,
   },
   totalsCardAmount: {
     color: '#ffffff',
     fontSize: 20,
     fontWeight: 'bold',
   },
  sectionLabel: {
    color: '#8e8e93',
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginHorizontal: 16,
    marginBottom: 8,
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
    marginBottom: 24,
  },
  emptyBalances: {
    color: '#8e8e93',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 16,
  },
   chartContainer: {
     width: '100%',
     paddingHorizontal: 16,
     paddingVertical: 16,
     gap: 14,
     backgroundColor: '#222327',
     borderRadius: 12,
     borderWidth: 1,
     borderColor: '#33353b',
   },
  chartWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    gap: 14,
  },
   barRow: {
     flexDirection: 'row',
     alignItems: 'center',
     height: 64,
     width: '100%',
     overflow: 'visible',
   },
   barSide: {
     flex: 1,
     height: '100%',
     justifyContent: 'center',
     overflow: 'visible',
   },
   barLabelSide: {
     flex: 0.5,
     paddingHorizontal: 8,
   },
    bar: {
      height: 48,
      borderRadius: 8,
      justifyContent: 'center',
      paddingHorizontal: 4,
    },
  barRed: {
    backgroundColor: '#ff6b6b',
    alignSelf: 'flex-end',
  },
   barGreen: {
     backgroundColor: '#10b981',
     alignSelf: 'flex-start',
   },
   barAmountIn: {
     color: '#ffffff',
     fontSize: 13,
     fontWeight: '700',
   },
   barAmountInOwe: {
     textAlign: 'right',
   },
  barName: {
    color: '#8e8e93',
    fontSize: 14,
    fontWeight: '600',
    minWidth: 110,
    textAlign: 'center',
  },
  barNameYou: {
    color: '#fbb81c',
  },
  centerLine: {
    width: 2,
    height: '100%',
    backgroundColor: '#33353b',
  },
  infoContent: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40, gap: 20 },
  infoSection: { gap: 12 },
  infoSectionTitle: { color: '#fbb81c', fontSize: 14, fontWeight: '600', textTransform: 'uppercase' },
  infoText: { color: '#ffffff', fontSize: 15, lineHeight: 22 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#2a2b30' },
  infoLabel: { color: '#8e8e93', fontSize: 15 },
  infoValue: { color: '#ffffff', fontSize: 15, fontWeight: '500' },
  infoSectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  addMemberBtn: { padding: 8 },
  memberRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  memberAvatar: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  memberAvatarText: { color: '#16171b', fontSize: 15, fontWeight: 'bold' },
  memberInfo: { flex: 1 },
  memberName: { color: '#ffffff', fontSize: 15, fontWeight: '600' },
  memberHandle: { color: '#8e8e93', fontSize: 12, marginTop: 2 },
  memberRole: { marginLeft: 12 },
  roleBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: '#2a2b30' },
  roleBadgeAdmin: { backgroundColor: '#fbb81c' },
  roleBadgeText: { color: '#ffffff', fontSize: 11, fontWeight: '600' },
  roleBadgeTextAdmin: { color: '#16171b' },
  memberSeparator: { height: 1, backgroundColor: '#2a2b30', marginLeft: 56 },
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