import { useLocalSearchParams, useRouter } from "expo-router";
import { View, FlatList, TouchableOpacity, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Receipt, Plus } from "lucide-react-native";
import { useEffect, useState } from "react";
import { useTabBarStore } from "../../store/tabBar";
import { fetchGroupBills } from "../../services/api";
import { groupNames, groupInfos, groupMembers } from "../../services/groupData";
import ActivityCard from "../../components/molecule/ActivityCard";
import EmptyState from "../../components/molecule/EmptyState";
import GroupHeader from "../../components/molecule/GroupHeader";
import TabPills from "../../components/molecule/TabPills";
import BalancesView from "../../components/molecule/BalancesView";
import TotalsView from "../../components/molecule/TotalsView";
import GroupInfoView from "../../components/molecule/GroupInfoView";
import GroupActionsDropdown from "../../components/molecule/GroupActionsDropdown";
import PaymentSheet from "../../components/molecule/PaymentSheet";
import CreateExpenseSheet from "../../components/molecule/CreateExpenseSheet";
import EditGroupSheet from "../../components/molecule/EditGroupSheet";
import ConfirmSheet from "../../components/molecule/ConfirmSheet";

export default function GroupDetails() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [bills, setBills] = useState([]);
  const [billsLoading, setBillsLoading] = useState(true);
  const [billsError, setBillsError] = useState(false);
  const [isPaymentVisible, setPaymentVisible] = useState(false);
  const [paymentCard, setPaymentCard] = useState(null);
  const [isKebabVisible, setKebabVisible] = useState(false);
  const [kebabButtonRect, setKebabButtonRect] = useState(null);
  const [isCreateExpenseVisible, setCreateExpenseVisible] = useState(false);
  const [isEditGroupVisible, setEditGroupVisible] = useState(false);
  const [isExitConfirmVisible, setExitConfirmVisible] = useState(false);
  const [isDeleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
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
  const currentUser = "John Doe";

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

  const handleEditGroupClose = () => {
    setEditGroupVisible(false);
    setMode("tabs");
    setCustomButtons([]);
  };

  const handleExitConfirmClose = () => {
    setExitConfirmVisible(false);
    setMode("tabs");
    setCustomButtons([]);
  };

  const handleDeleteConfirmClose = () => {
    setDeleteConfirmVisible(false);
    setMode("tabs");
    setCustomButtons([]);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <GroupHeader
        groupName={groupName}
        onKebabPress={() => setKebabVisible(true)}
        onKebabLayout={(e) => setKebabButtonRect(e.nativeEvent.layout)}
      />

      <TabPills tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

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
            <EmptyState
              icon={Receipt}
              iconColor="#33353b"
              title="No expenses yet"
              subtitle="Expenses added to this group will appear here"
              actionLabel="Add Expense"
              actionIcon={Plus}
              onAction={handleCreateExpense}
            />
          }
        />
      )}

      {activeTab === "balances" && (
        <BalancesView
          bills={bills}
          members={members}
          currentUser={currentUser}
          billsLoading={billsLoading}
          billsError={billsError}
          onPayPress={handlePayPress}
        />
      )}

      {activeTab === "totals" && (
        <TotalsView bills={bills} currentUser={currentUser} />
      )}

      {activeTab === "info" && (
        <GroupInfoView groupInfo={groupInfo} members={members} />
      )}

      {isKebabVisible && (
        <GroupActionsDropdown
          isVisible={isKebabVisible}
          onClose={() => setKebabVisible(false)}
          anchorRect={kebabButtonRect}
          onSelect={(action) => {
            if (action === "edit") {
              setEditGroupVisible(true);
              setMode("custom");
              setCustomButtons([
                { label: "Cancel", variant: "cancel", onPress: () => { setEditGroupVisible(false); setMode("tabs"); setCustomButtons([]); } },
                { label: "Save", variant: "primary", onPress: () => { setEditGroupVisible(false); setMode("tabs"); setCustomButtons([]); } },
              ]);
            }
            if (action === "members") {
              setKebabVisible(false);
              setMode("tabs");
              setCustomButtons([]);
              router.push(`/screens/ManageMembers?id=${id}`);
            }
            if (action === "analytics") { /* TODO: view analytics */ }
            if (action === "delete") {
              setDeleteConfirmVisible(true);
              setMode("custom");
              setCustomButtons([
                { label: "Cancel", variant: "cancel", onPress: () => { setDeleteConfirmVisible(false); setMode("tabs"); setCustomButtons([]); } },
                { label: "Delete", variant: "primary", onPress: () => { setDeleteConfirmVisible(false); setMode("tabs"); setCustomButtons([]); /* TODO: delete group */ } },
              ]);
            }
            if (action === "exit") {
              setExitConfirmVisible(true);
              setMode("custom");
              setCustomButtons([
                { label: "Cancel", variant: "cancel", onPress: () => { setExitConfirmVisible(false); setMode("tabs"); setCustomButtons([]); } },
                { label: "Exit", variant: "primary", onPress: () => { setExitConfirmVisible(false); setMode("tabs"); setCustomButtons([]); /* TODO: exit group */ } },
              ]);
            }
          }}
        />
      )}

      {paymentCard && (
        <PaymentSheet
          isVisible={isPaymentVisible}
          onClose={handlePaymentClose}
          paymentCard={paymentCard}
        />
      )}

      <TouchableOpacity style={styles.fab} onPress={handleCreateExpense}>
        <Plus size={28} color="#16171b" />
      </TouchableOpacity>

      <CreateExpenseSheet
        isVisible={isCreateExpenseVisible}
        onClose={handleCreateExpenseClose}
      />

      <EditGroupSheet
        isVisible={isEditGroupVisible}
        onClose={handleEditGroupClose}
        groupInfo={groupInfo}
      />

      <ConfirmSheet
        isVisible={isExitConfirmVisible}
        onClose={handleExitConfirmClose}
        title={`Do you want to leave "${groupName}"?`}
        confirmLabel="Yes, exit group"
      />

      <ConfirmSheet
        isVisible={isDeleteConfirmVisible}
        onClose={handleDeleteConfirmClose}
        title={`Are you sure you want to delete "${groupName}"?`}
        subtitle="All members and expenses will be deleted also. This action cannot be undone!"
        confirmLabel="Yes, delete group"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#16171b', paddingHorizontal: 16 },
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
});
