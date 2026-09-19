import { useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from "react-native";
import { ChartBar } from "lucide-react-native";
import EmptyState from "./EmptyState";

const totalsPeriods = ["All", "1D", "1W", "4W", "3M", "1Y"];

const parseAmount = (amt) => {
  const n = parseFloat((amt || "0").replace(/[^0-9.\-]/g, ""));
  return isNaN(n) ? 0 : n;
};

const formatTotal = (val) => {
  const n = Number(val) || 0;
  return `\u20B5${n.toFixed(2)}`;
};

const formatSignedCurrency = (val) => {
  const n = Number(val) || 0;
  const sign = n < 0 ? "-" : "+";
  return `${sign}\u20B5${Math.abs(n).toFixed(2)}`;
};

export default function TotalsView({ bills, currentUser }) {
  const [totalsPeriod, setTotalsPeriod] = useState("All");

  const totalGroupSpending = bills.reduce((sum, bill) => sum + parseAmount(bill.amount), 0);
  const totalYouPaid = bills
    .filter((bill) => bill.senderName === currentUser)
    .reduce((sum, bill) => sum + parseAmount(bill.amount), 0);
  const yourTotalShare = bills
    .filter((bill) => bill.receipientName === currentUser)
    .reduce((sum, bill) => sum + parseAmount(bill.amount), 0);

  const totalYouOwe = bills
    .filter((bill) => bill.senderName === currentUser && bill.initialStatus === "pay")
    .reduce((sum, bill) => sum + parseAmount(bill.amount), 0);
  const totalOwedToYou = bills
    .filter((bill) => bill.receipientName === currentUser && bill.initialStatus === "request")
    .reduce((sum, bill) => sum + parseAmount(bill.amount), 0);
  const netBalance = totalOwedToYou - totalYouOwe;
  const expenseCount = bills.length;
  const averageExpense = expenseCount > 0 ? totalGroupSpending / expenseCount : 0;

  return (
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

      {bills.length === 0 ? (
        <EmptyState
          icon={ChartBar}
          iconColor="#33353b"
          title="No spending data"
          subtitle="Totals will appear once expenses are added to this group"
        />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
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

          <View style={styles.totalsCard}>
            <Text style={styles.totalsCardTitle}>Total you owe</Text>
            <Text style={[styles.totalsCardAmount, styles.amountOwe]}>
              {formatSignedCurrency(totalYouOwe)}
            </Text>
          </View>

          <View style={styles.totalsCard}>
            <Text style={styles.totalsCardTitle}>Total owed to you</Text>
            <Text style={[styles.totalsCardAmount, styles.amountOwed]}>
              {formatSignedCurrency(totalOwedToYou)}
            </Text>
          </View>

          <View style={styles.totalsCard}>
            <Text style={styles.totalsCardTitle}>Your net balance</Text>
            <Text style={[
              styles.totalsCardAmount,
              netBalance > 0 ? styles.amountOwed : netBalance < 0 ? styles.amountOwe : styles.amountSettled
            ]}>
              {formatSignedCurrency(netBalance)}
            </Text>
          </View>

          <View style={styles.totalsCard}>
            <Text style={styles.totalsCardTitle}>Number of expenses</Text>
            <Text style={styles.totalsCardAmount}>{expenseCount}</Text>
          </View>

          <View style={styles.totalsCard}>
            <Text style={styles.totalsCardTitle}>Average expense</Text>
            <Text style={styles.totalsCardAmount}>{formatTotal(averageExpense)}</Text>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tabContent: {
    paddingHorizontal: 0,
  },
  totalsPills: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  totalsPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#2a2b30",
    alignItems: "center",
    justifyContent: "center",
  },
  totalsPillActive: {
    backgroundColor: "#fbb81c",
  },
  totalsPillText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "600",
  },
  totalsPillTextActive: {
    color: "#16171b",
  },
  totalsCard: {
    backgroundColor: "#222327",
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#33353b",
  },
  totalsCardTitle: {
    color: "#8e8e93",
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  totalsCardAmount: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "bold",
  },
  amountOwe: {
    color: "#ff6b6b",
  },
  amountOwed: {
    color: "#10b981",
  },
  amountSettled: {
    color: "#8e8e93",
  },
});
