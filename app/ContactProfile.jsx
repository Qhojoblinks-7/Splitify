import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Linking, FlatList } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronLeft, Phone, Mail, Send, Download, ArrowUpRight, Users, ArrowRight } from "lucide-react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import ActivityCard from "../components/molecule/ActivityCard";

const sampleGroups = {
  "1": [
    { id: "g1", name: "Roommates", memberCount: 4, totalExpenses: "1,250.00 GHC", color: "#fbb81c", lastActivity: "2 hours ago" },
    { id: "g2", name: "Trip to Bali", memberCount: 6, totalExpenses: "3,450.00 GHC", color: "#3b82f6", lastActivity: "1 day ago" },
  ],
  "2": [
    { id: "g3", name: "Office Lunch", memberCount: 8, totalExpenses: "890.00 GHC", color: "#10b981", lastActivity: "3 days ago" },
  ],
  "3": [
    { id: "g4", name: "Family Expenses", memberCount: 5, totalExpenses: "2,100.00 GHC", color: "#f97316", lastActivity: "1 week ago" },
    { id: "g5", name: "Trip to Bali", memberCount: 6, totalExpenses: "3,450.00 GHC", color: "#3b82f6", lastActivity: "1 day ago" },
  ],
  "4": [
    { id: "g3", name: "Office Lunch", memberCount: 8, totalExpenses: "890.00 GHC", color: "#10b981", lastActivity: "3 days ago" },
  ],
  "5": [
    { id: "g2", name: "Trip to Bali", memberCount: 6, totalExpenses: "3,450.00 GHC", color: "#3b82f6", lastActivity: "1 day ago" },
  ],
  "6": [
    { id: "g1", name: "Roommates", memberCount: 4, totalExpenses: "1,250.00 GHC", color: "#fbb81c", lastActivity: "2 hours ago" },
    { id: "g4", name: "Family Expenses", memberCount: 5, totalExpenses: "2,100.00 GHC", color: "#f97316", lastActivity: "1 week ago" },
  ],
  "7": [
    { id: "g2", name: "Trip to Bali", memberCount: 6, totalExpenses: "3,450.00 GHC", color: "#3b82f6", lastActivity: "1 day ago" },
  ],
  "8": [
    { id: "g1", name: "Roommates", memberCount: 4, totalExpenses: "1,250.00 GHC", color: "#fbb81c", lastActivity: "2 hours ago" },
  ],
  "9": [
    { id: "g3", name: "Office Lunch", memberCount: 8, totalExpenses: "890.00 GHC", color: "#10b981", lastActivity: "3 days ago" },
  ],
  "10": [
    { id: "g5", name: "Family Expenses", memberCount: 5, totalExpenses: "2,100.00 GHC", color: "#f97316", lastActivity: "1 week ago" },
  ],
};

const sampleTransactions = {
  "1": [
    { id: "t1", title: "Dinner at Restaurant", amount: "45.00 GHC", receipientName: "Ama Boateng", initialStatus: "pay" },
    { id: "t2", title: "Grocery Shopping", amount: "120.50 GHC", receipientName: "Ama Boateng", initialStatus: "paid" },
  ],
  "2": [
    { id: "t3", title: "Movie Night", amount: "35.00 GHC", receipientName: "John Doe", initialStatus: "request" },
    { id: "t4", title: "Uber Ride", amount: "18.00 GHC", receipientName: "John Doe", initialStatus: "paid" },
  ],
  "3": [
    { id: "t5", title: "Coffee Shop", amount: "12.00 GHC", receipientName: "Emily Davis", initialStatus: "pay" },
  ],
  "4": [
    { id: "t6", title: "Lunch Break", amount: "28.00 GHC", receipientName: "Kofi Mensah", initialStatus: "request" },
    { id: "t7", title: "Concert Tickets", amount: "150.00 GHC", receipientName: "Kofi Mensah", initialStatus: "paid" },
  ],
  "5": [
    { id: "t8", title: "Book Store", amount: "22.00 GHC", receipientName: "Sarah Johnson", initialStatus: "pay" },
  ],
  "6": [
    { id: "t9", title: "Dinner at Restaurant", amount: "45.00 GHC", receipientName: "Michael Brown", initialStatus: "request" },
    { id: "t10", title: "Parking Fee", amount: "8.00 GHC", receipientName: "Michael Brown", initialStatus: "paid" },
  ],
  "7": [
    { id: "t11", title: "Gym Membership", amount: "60.00 GHC", receipientName: "Fatima Al-Hassan", initialStatus: "pay" },
  ],
  "8": [
    { id: "t12", title: "Lunch Break", amount: "28.00 GHC", receipientName: "Kwame Asante", initialStatus: "paid" },
  ],
  "9": [
    { id: "t13", title: "Coffee Shop", amount: "12.00 GHC", receipientName: "Ama Aboagye", initialStatus: "request" },
  ],
  "10": [
    { id: "t14", title: "Office Supplies", amount: "45.00 GHC", receipientName: "Daniel Osei", initialStatus: "pay" },
    { id: "t15", title: "Team Lunch", amount: "89.00 GHC", receipientName: "Daniel Osei", initialStatus: "paid" },
  ],
};

export default function ContactProfile() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams();

  const name = params.name || "";
  const handle = params.handle || "";
  const initials = params.initials || "";
  const phone = params.phone || "";
  const email = params.email || "";
  const balance = params.balance || "";
  const contactId = params.id || "";

  const [sendPressed, setSendPressed] = useState(false);
  const [requestPressed, setRequestPressed] = useState(false);
  const [payPressed, setPayPressed] = useState(false);

  const showPay = balance && parseFloat(balance) > 0;
  const contactGroups = sampleGroups[contactId] || [];
  const contactTransactions = sampleTransactions[contactId] || [];

  const onPressBack = () => router.back();

  const onPressCall = () => {
    if (phone) Linking.openURL(`tel:${phone.replace(/\s/g, "")}`);
  };

  const onPressEmail = () => {
    if (email) Linking.openURL(`mailto:${email}`);
  };

  const onPressSend = () => {
    setSendPressed(true);
    setTimeout(() => setSendPressed(false), 300);
    router.push("/SendMoney");
  };

  const onPressRequest = () => {
    setRequestPressed(true);
    setTimeout(() => setRequestPressed(false), 300);
    router.push("/RequestMoney");
  };

  const onPressPay = () => {
    setPayPressed(true);
    setTimeout(() => setPayPressed(false), 300);
    router.push("/SendMoney");
  };

  const renderGroupItem = ({ item }) => (
    <TouchableOpacity
      style={styles.groupCard}
      onPress={() => router.push(`/group/${item.id}`)}
      activeOpacity={0.8}
    >
      <View style={[styles.groupAvatar, { backgroundColor: item.color }]}>
        <Users size={20} color="#16171b" />
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
      <ArrowRight size={16} color="#8e8e93" />
    </TouchableOpacity>
  );

  const renderTransactionItem = ({ item }) => (
    <ActivityCard
      title={item.title}
      amount={item.amount}
      receipientName={item.receipientName}
      initialStatus={item.initialStatus}
      onPayPress={() => {}}
    />
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onPressBack}>
          <ChevronLeft size={28} color="#ffffff" />
        </TouchableOpacity>

        <View style={styles.avatarWrap}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <Text style={styles.name}>{name}</Text>
          {handle && <Text style={styles.handle}>{handle}</Text>}
        </View>

        <View style={styles.actionsRow}>
          <View style={styles.actionItem}>
            <TouchableOpacity
              style={[styles.coinCircle, sendPressed && styles.coinPressed]}
              onPress={onPressSend}
              activeOpacity={0.8}
            >
              <Send size={20} color="#16171b" />
            </TouchableOpacity>
            <Text style={styles.actionLabel}>Send</Text>
          </View>
          <View style={styles.actionItem}>
            <TouchableOpacity
              style={[styles.coinCircle, requestPressed && styles.coinPressed]}
              onPress={onPressRequest}
              activeOpacity={0.8}
            >
              <Download size={20} color="#16171b" />
            </TouchableOpacity>
            <Text style={styles.actionLabel}>Request</Text>
          </View>
          {showPay && (
            <View style={styles.actionItem}>
              <TouchableOpacity
                style={[styles.coinCirclePay, payPressed && styles.coinPressed]}
                onPress={onPressPay}
                activeOpacity={0.8}
              >
                <ArrowUpRight size={20} color="#ffffff" />
              </TouchableOpacity>
              <Text style={[styles.actionLabel, styles.actionLabelPay]}>Pay</Text>
            </View>
          )}
        </View>

        {showPay && (
          <Text style={styles.balanceText}>You owe {name.split(" ")[0]} {balance}</Text>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.infoSection}>
          {phone && (
            <TouchableOpacity style={styles.infoRow} onPress={onPressCall}>
              <View style={styles.infoLeft}>
                <Phone size={20} color="#fbb81c" />
                <Text style={styles.infoLabel}>Phone</Text>
              </View>
              <Text style={styles.infoValue}>{phone}</Text>
            </TouchableOpacity>
          )}
          {email && (
            <TouchableOpacity style={styles.infoRow} onPress={onPressEmail}>
              <View style={styles.infoLeft}>
                <Mail size={20} color="#fbb81c" />
                <Text style={styles.infoLabel}>Email</Text>
              </View>
              <Text style={styles.infoValue}>{email}</Text>
            </TouchableOpacity>
          )}
        </View>

        {contactGroups.length > 0 && (
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>Groups</Text>
            <FlatList
              data={contactGroups}
              keyExtractor={(item) => item.id}
              renderItem={renderGroupItem}
              scrollEnabled={false}
            />
          </View>
        )}

        {contactTransactions.length > 0 && (
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>Transactions</Text>
            {contactTransactions.map((tx) => (
              <View key={tx.id} style={styles.transactionItem}>
                <ActivityCard
                  title={tx.title}
                  amount={tx.amount}
                  receipientName={tx.receipientName}
                  initialStatus={tx.initialStatus}
                  onPayPress={() => {}}
                />
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#16171b" },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#2a2b30",
  },
  scrollContent: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 48 },
  backBtn: { padding: 4, marginBottom: 20 },
  avatarWrap: { alignItems: "center", paddingVertical: 24 },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "#fbb81c",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  avatarText: { color: "#16171b", fontSize: 28, fontWeight: "bold" },
  name: { color: "#ffffff", fontSize: 24, fontWeight: "bold" },
  handle: { color: "#8e8e93", fontSize: 15, marginTop: 4 },
  actionsRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "flex-start",
    gap: 24,
    marginTop: 8,
  },
  actionItem: { alignItems: "center" },
  coinCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#fbb81c",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  coinCirclePay: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#ef4444",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  coinPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.96 }],
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#8e8e93",
    marginTop: 8,
  },
  actionLabelPay: {
    color: "#ef4444",
  },
  balanceText: {
    color: "#ef4444",
    fontSize: 14,
    textAlign: "center",
    marginTop: 12,
    fontWeight: "500",
  },
  infoSection: {
    backgroundColor: "#1e1f24",
    borderRadius: 14,
    paddingHorizontal: 16,
    marginTop: 24,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#2a2b30",
  },
  infoLeft: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 12,
    width: 80,
  },
  infoLabel: { color: "#ffffff", fontSize: 15, fontWeight: "600" },
  infoValue: { color: "#8e8e93", fontSize: 15, flex: 1 },
  sectionContainer: { marginTop: 24 },
  sectionTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 12,
  },
  groupCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1e1f24",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  groupAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  groupInfo: { flex: 1 },
  groupName: { color: "#ffffff", fontSize: 15, fontWeight: "600" },
  groupMeta: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  groupMetaText: { color: "#8e8e93", fontSize: 12 },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: "#33353b", marginHorizontal: 8 },
  lastActivity: { color: "#5a5a5e", fontSize: 11, marginTop: 2 },
  transactionItem: { marginBottom: 10 },
});
