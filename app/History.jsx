import React, { useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import { Text, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronLeft,
  Clock3,
  Building2,
  Search,
  WalletCards,
} from "lucide-react-native";
import { getDayLabel, makeDate, makeMonthAgo } from "../utils/dayLabel";

const transactions = [
  {
    id: "1",
    date: makeDate(0),
    title: "Dinner at Restaurant",
    counterparty: "Ama Boateng",
    amount: "45.00",
    type: "sent",
    status: "Completed",
    method: "Splitify Balance",
  },
  {
    id: "2",
    date: makeDate(0),
    title: "Salary for June",
    counterparty: "Jane Smith",
    amount: "1,500.00",
    type: "received",
    status: "Completed",
    method: "Bank transfer",
  },
  {
    id: "3",
    date: makeDate(1),
    title: "Top up balance",
    counterparty: "Visa ending 4242",
    amount: "250.00",
    type: "topup",
    status: "Completed",
    method: "Visa ending 4242",
  },
  {
    id: "4",
    date: makeDate(1),
    title: "Grocery shopping",
    counterparty: "Kofi Mensah",
    amount: "120.50",
    type: "sent",
    status: "Completed",
    method: "Splitify Balance",
  },
  {
    id: "5",
    date: makeDate(3),
    title: "Freelance project",
    counterparty: "Emily Davis",
    amount: "600.00",
    type: "received",
    status: "Pending",
    method: "Mobile Money",
  },
  {
    id: "6",
    date: makeDate(3),
    title: "Withdrawal",
    counterparty: "GCB Bank ending 8890",
    amount: "300.00",
    type: "withdrawn",
    status: "Completed",
    method: "Bank transfer",
  },
  {
    id: "7",
    date: makeMonthAgo(15),
    title: "Old bank transfer",
    counterparty: "Bob Wilson",
    amount: "75.00",
    type: "received",
    status: "Completed",
    method: "Bank transfer",
  },
];

const filters = [
  { label: "All", value: "all" },
  { label: "Sent", value: "sent" },
  { label: "Received", value: "received" },
  { label: "Top Ups", value: "topup" },
  { label: "Withdrawals", value: "withdrawn" },
];

export default function History() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [activeFilter, setActiveFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredTransactions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return transactions
      .filter((transaction) => {
        const matchesFilter =
          activeFilter === "all" || transaction.type === activeFilter;
        const matchesSearch =
          !query ||
          [
            transaction.title,
            transaction.counterparty,
            transaction.method,
            transaction.status,
          ]
            .join(" ")
            .toLowerCase()
            .includes(query);
        return matchesFilter && matchesSearch;
      })
      .sort((a, b) => b.date - a.date);
  }, [activeFilter, searchQuery]);

  const groupedTransactions = useMemo(() => {
    return filteredTransactions.reduce((groups, transaction) => {
      const day = getDayLabel(transaction.date);
      const group = groups.find((item) => item.day === day);
      if (group) {
        group.items.push(transaction);
      } else {
        groups.push({ day, items: [transaction] });
      }
      return groups;
    }, []);
  }, [filteredTransactions]);

  const getTransactionIcon = (type) => {
    if (type === "received") {
      return <ArrowDownLeft size={20} color="#16171b" />;
    }
    if (type === "topup") {
      return <WalletCards size={20} color="#16171b" />;
    }
    if (type === "withdrawn") {
      return <Building2 size={20} color="#16171b" />;
    }
    return <ArrowUpRight size={20} color="#16171b" />;
  };

  const getAmountStyle = (type) => {
    if (type === "received" || type === "topup") {
      return styles.positiveAmount;
    }
    return styles.negativeAmount;
  };

  const getAmountPrefix = (type) => {
    if (type === "received" || type === "topup") {
      return "+";
    }
    return "-";
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={styles.headerButton}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <ChevronLeft size={28} color="#ffffff" />
        </Pressable>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>History</Text>
          <Text style={styles.headerSubtitle}>Your money movements</Text>
        </View>
      </View>

      <View style={styles.searchBox}>
        <Search size={20} color="#8e8e93" />
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search transactions"
          placeholderTextColor="#8e8e93"
          style={styles.searchInput}
          accessibilityLabel="Search transactions"
        />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        {filters.map((filter) => (
          <Pressable
            key={filter.value}
            onPress={() => setActiveFilter(filter.value)}
            style={({ pressed }) => [
              styles.filterPill,
              activeFilter === filter.value && styles.filterPillActive,
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={`Show ${filter.label}`}
          >
            <Text
              style={[
                styles.filterText,
                activeFilter === filter.value && styles.filterTextActive,
              ]}
            >
              {filter.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <ScrollView
        style={styles.transactionList}
        contentContainerStyle={styles.transactionListContent}
        showsVerticalScrollIndicator={false}
      >
        {groupedTransactions.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Clock3 size={28} color="#fbb81c" />
            </View>
            <Text style={styles.emptyTitle}>No transactions found</Text>
            <Text style={styles.emptyText}>Try a different search or filter.</Text>
          </View>
        ) : (
          groupedTransactions.map((group) => (
            <View key={group.day} style={styles.dayGroup}>
              <View style={styles.dayDivider}>
                <Text style={styles.dayLabel}>{group.day}</Text>
                <View style={styles.dayLine} />
              </View>
              {group.items.map((transaction) => (
                <View
                  key={transaction.id}
                  style={styles.transactionCard}
                >
                  <View style={styles.transactionIcon}>
                    {getTransactionIcon(transaction.type)}
                  </View>
                  <View style={styles.transactionDetails}>
                    <Text style={styles.transactionTitle} numberOfLines={1}>
                      {transaction.title}
                    </Text>
                    <Text style={styles.transactionCounterparty} numberOfLines={1}>
                      {transaction.counterparty}
                    </Text>
                    <Text style={styles.transactionMethod} numberOfLines={1}>
                      {transaction.method} · {transaction.status}
                    </Text>
                  </View>
                  <View style={styles.transactionAmountWrap}>
                    <Text style={[styles.transactionAmount, getAmountStyle(transaction.type)]}>
                      {getAmountPrefix(transaction.type)}GHC {transaction.amount}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          ))
        )}
        <View style={styles.bottomPadding} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#16171b",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  headerButton: {
    padding: 4,
  },
  headerTitleWrap: {
    flex: 1,
    alignItems: "center",
  },
  headerTitle: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "bold",
  },
  headerSubtitle: {
    color: "#8e8e93",
    fontSize: 12,
    marginTop: 2,
  },
  searchBox: {
    minHeight: 50,
    marginHorizontal: 20,
    marginBottom: 14,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2a2b30",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#33353b",
  },
  searchInput: {
    flex: 1,
    color: "#ffffff",
    fontSize: 15,
    marginLeft: 10,
    paddingVertical: 14,
  },
  filterRow: {
    paddingHorizontal: 20,
    gap: 8,
    marginBottom: 18,
  },
  filterPill: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 18,
    backgroundColor: "#2a2b30",
    borderWidth: 1,
    borderColor: "#33353b",
  },
  filterPillActive: {
    backgroundColor: "#fbb81c",
    borderColor: "#fbb81c",
  },
  filterText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "600",
  },
  filterTextActive: {
    color: "#16171b",
  },
  transactionList: {
    flex: 1,
  },
  transactionListContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  dayGroup: {
    marginBottom: 22,
  },
  dayDivider: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  dayLabel: {
    color: "#8e8e93",
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  dayLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#2a2b30",
    marginLeft: 10,
  },
  transactionCard: {
    minHeight: 78,
    marginBottom: 10,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2a2b30",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#33353b",
  },
  transactionIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "#fbb81c",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  transactionDetails: {
    flex: 1,
    minWidth: 0,
  },
  transactionTitle: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "600",
  },
  transactionCounterparty: {
    color: "#ffffff",
    fontSize: 13,
    marginTop: 3,
  },
  transactionMethod: {
    color: "#8e8e93",
    fontSize: 12,
    marginTop: 3,
  },
  transactionAmountWrap: {
    alignItems: "flex-end",
  },
  transactionAmount: {
    fontSize: 14,
    fontWeight: "700",
  },
  positiveAmount: {
    color: "#fbb81c",
  },
  negativeAmount: {
    color: "#ffffff",
  },
  emptyState: {
    alignItems: "center",
    paddingTop: 70,
    paddingHorizontal: 30,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#2a2b30",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "bold",
  },
  emptyText: {
    color: "#8e8e93",
    fontSize: 14,
    textAlign: "center",
    marginTop: 6,
  },
  bottomPadding: {
    height: 20,
  },
  pressed: {
    opacity: 0.78,
  },
});
