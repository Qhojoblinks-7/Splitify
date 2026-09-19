import { View, Text, ScrollView, StyleSheet } from "react-native";
import { Wallet } from "lucide-react-native";
import ActivityCard from "./ActivityCard";
import EmptyState from "./EmptyState";

const parseAmount = (amt) => {
  const n = parseFloat((amt || "0").replace(/[^0-9.\-]/g, ""));
  return isNaN(n) ? 0 : n;
};

const formatBarAmount = (val) => {
  const n = Number(val) || 0;
  const sign = n < 0 ? "-" : "+";
  return `${sign}\u20B5${Math.abs(n).toFixed(2)}`;
};

export default function BalancesView({ bills, members, currentUser, billsLoading, billsError, onPayPress }) {
  const balances = (() => {
    const bals = {};
    members.forEach((m) => { bals[m.name] = 0; });
    if (!bals[currentUser]) bals[currentUser] = 0;

    bills.forEach((bill) => {
      const amount = parseAmount(bill.amount);
      if (bill.initialStatus === "pay") {
        bals[bill.receipientName] = (bals[bill.receipientName] || 0) + amount;
        bals[currentUser] = (bals[currentUser] || 0) - amount;
      } else if (bill.initialStatus === "request") {
        bals[bill.senderName] = (bals[bill.senderName] || 0) - amount;
        bals[currentUser] = (bals[currentUser] || 0) + amount;
      }
    });

    return bals;
  })();

  const entries = Object.entries(balances)
    .map(([name, net]) => ({ name, net }))
    .filter((e) => e.net !== 0)
    .sort((a, b) => Math.abs(b.net) - Math.abs(a.net));

  const outstandingBills = bills.filter((bill) => bill.initialStatus !== "paid");
  const maxAbs = Math.max(...entries.map((e) => Math.abs(e.net)), 1);

  if (billsLoading) {
    return (
      <View style={styles.centeredContent}>
        <Text style={styles.emptyBalances}>Loading balances...</Text>
      </View>
    );
  }

  if (billsError) {
    return (
      <View style={styles.centeredContent}>
        <Text style={styles.emptyBalances}>Couldn't load balances</Text>
      </View>
    );
  }

  if (entries.length === 0) {
    if (bills.length === 0) {
      return (
        <EmptyState
          icon={Wallet}
          iconColor="#33353b"
          title="No balances to show"
          subtitle="No expenses have been added to this group yet"
        />
      );
    }
    return (
      <View style={styles.centeredContent}>
        <Text style={styles.emptyBalances}>All settled up!</Text>
      </View>
    );
  }

  return (
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
            onPayPress={onPayPress}
          />
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  tabContent: { paddingHorizontal: 0 },
  centeredContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  emptyBalances: {
    color: "#8e8e93",
    fontSize: 16,
    textAlign: "center",
    marginTop: 16,
  },
  chartContainer: {
    width: "100%",
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 14,
    backgroundColor: "#222327",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#33353b",
  },
  barRow: {
    flexDirection: "row",
    alignItems: "center",
    height: 64,
    width: "100%",
    overflow: "visible",
  },
  barSide: {
    flex: 1,
    height: "100%",
    justifyContent: "center",
    overflow: "visible",
  },
  barLabelSide: {
    flex: 0.5,
    paddingHorizontal: 8,
  },
  bar: {
    height: 48,
    borderRadius: 8,
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  barRed: {
    backgroundColor: "#ff6b6b",
    alignSelf: "flex-end",
  },
  barGreen: {
    backgroundColor: "#10b981",
    alignSelf: "flex-start",
  },
  barAmountIn: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },
  barAmountInOwe: {
    textAlign: "right",
  },
  barName: {
    color: "#8e8e93",
    fontSize: 14,
    fontWeight: "600",
    minWidth: 110,
    textAlign: "center",
  },
  barNameYou: {
    color: "#fbb81c",
  },
  centerLine: {
    width: 2,
    height: "100%",
    backgroundColor: "#33353b",
  },
});
