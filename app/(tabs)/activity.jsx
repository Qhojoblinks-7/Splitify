import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, SectionList, TouchableOpacity, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  ArrowDownLeft,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Inbox,
  RefreshCw,
} from "lucide-react-native";
import OfflineBanner from "../../components/molecule/OfflineBanner";
import { SkeletonBlock } from "../../components/molecule/Skeleton";
import { useSusuStore } from "../../store/susu";
import { getDayLabel } from "../../utils/dayLabel";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "contribution", label: "Contributions" },
  { id: "payout", label: "Payouts" },
  { id: "attention", label: "Needs attention" },
];

const NEEDS_ATTENTION = new Set(["pending", "failed", "flagged"]);

export default function Activity() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const userId = useSusuStore((s) => s.userId);
  const allGroups = useSusuStore((s) => s.groups);
  const isLoading = useSusuStore((s) => s.isLoading);
  const loadError = useSusuStore((s) => s.loadError);
  const loadGroups = useSusuStore((s) => s.loadGroups);
  const [filter, setFilter] = useState("all");

  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadGroups();
    setRefreshing(false);
  };

  const groups = useMemo(
    () => allGroups.filter((g) => g.members.some((m) => m.id === userId)),
    [allGroups, userId]
  );

  const entries = useMemo(() => {
    const nameOf = (group, memberId) =>
      group.members.find((m) => m.id === memberId)?.name || "Member";

    const flat = groups.flatMap((group) => [
      ...group.contributions.map((c) => ({
        id: c.id,
        kind: "contribution",
        groupId: group.id,
        groupName: group.name,
        memberName: nameOf(group, c.memberId),
        mine: c.memberId === userId,
        roundNumber: c.roundNumber,
        amount: c.amount,
        status: c.status,
        syncState: c.syncState,
        reference: c.reference,
        at: c.paidAt || 0,
      })),
      ...group.payouts.map((p) => ({
        id: p.id,
        kind: "payout",
        groupId: group.id,
        groupName: group.name,
        memberName: p.memberId ? nameOf(group, p.memberId) : "Round skipped",
        mine: p.memberId === userId,
        roundNumber: p.roundNumber,
        amount: p.amount,
        status: p.status,
        reference: p.reference || p.reason,
        at: p.completedAt || p.startedAt || 0,
      })),
    ]);

    return flat.sort((a, b) => b.at - a.at);
  }, [groups, userId]);

  const visible = useMemo(() => {
    if (filter === "all") return entries;
    if (filter === "attention") return entries.filter((e) => NEEDS_ATTENTION.has(e.status));
    return entries.filter((e) => e.kind === filter);
  }, [entries, filter]);

  const attentionCount = useMemo(
    () => entries.filter((e) => NEEDS_ATTENTION.has(e.status)).length,
    [entries]
  );

  const sections = useMemo(() => {
    const buckets = new Map();
    for (const entry of visible) {
      const day = getDayLabel(new Date(entry.at));
      if (!buckets.has(day)) buckets.set(day, []);
      buckets.get(day).push(entry);
    }
    return [...buckets.entries()].map(([title, data]) => ({ title, data }));
  }, [visible]);

  const renderEntry = ({ item }) => (
    <TouchableOpacity style={styles.row} onPress={() => router.push(`/susu/${item.groupId}`)} activeOpacity={0.8}>
      <View style={styles.iconWrap}>
        {item.kind === "payout" ? (
          <ArrowDownLeft size={15} color={item.status === "completed" ? "#4ade80" : "#ef4444"} />
        ) : item.status === "verified" ? (
          <CheckCircle2 size={15} color="#4ade80" />
        ) : item.status === "failed" || item.status === "flagged" ? (
          <XCircle size={15} color="#ef4444" />
        ) : item.status === "skipped" ? (
          <AlertTriangle size={15} color="#f97316" />
        ) : (
          <Clock size={15} color="#fbb81c" />
        )}
      </View>

      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={1}>
          {item.kind === "payout" ? `Payout to ${item.memberName}` : `${item.memberName} contributed`}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {item.groupName} · Round {item.roundNumber}
        </Text>
        <View style={styles.badgeRow}>
          <Text style={[styles.status, statusColor(item.status)]}>
            {item.kind === "payout" ? payoutLabel(item.status) : contributionLabel(item.status)}
          </Text>
          {item.syncState === "offline" ? (
            <Text style={[styles.status, { color: "#a1a1aa" }]}>Saved offline</Text>
          ) : null}
          {item.mine ? <Text style={styles.youTag}>YOU</Text> : null}
        </View>
      </View>

      {/*
        A contribution is money moving into the pot, not a bill leaving the
        wallet. Only a payout is incoming, so only a payout gets a plus sign.
      */}
      <Text
        style={[
          styles.amount,
          item.kind === "payout" ? styles.amountPayout : styles.amountNeutral,
        ]}
      >
        {item.amount > 0 ? `GHC ${item.amount.toLocaleString()}` : "—"}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <OfflineBanner />

      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.heading}>Activity</Text>
        <Text style={styles.sub}>
          Everything across your {groups.length} susu {groups.length === 1 ? "group" : "groups"}
        </Text>
      </View>

      <View style={styles.filters}>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f.id}
            style={[styles.chip, filter === f.id && styles.chipActive]}
            onPress={() => setFilter(f.id)}
          >
            <Text style={[styles.chipText, filter === f.id && styles.chipTextActive]}>
              {f.label}
              {f.id === "attention" && attentionCount > 0 ? ` (${attentionCount})` : ""}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={renderEntry}
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionHeader}>{section.title}</Text>
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        stickySectionHeadersEnabled={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#fbb81c"
            colors={["#fbb81c"]}
          />
        }
        ListEmptyComponent={
          isLoading ? (
            <View style={styles.skeletonWrap}>
              {[0, 1, 2, 3].map((i) => (
                <View key={i} style={styles.skeletonRow}>
                  <SkeletonBlock width={30} height={30} radius={15} />
                  <View style={styles.skeletonInfo}>
                    <SkeletonBlock width="70%" height={14} />
                    <SkeletonBlock width="45%" height={12} style={styles.skeletonGap} />
                  </View>
                  <SkeletonBlock width={60} height={14} />
                </View>
              ))}
            </View>
          ) : loadError ? (
            <View style={styles.empty}>
              <AlertTriangle size={56} color="#ef4444" />
              <Text style={styles.emptyTitle}>Could not load your activity</Text>
              <Text style={styles.emptyText}>{loadError}</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={onRefresh}>
                <RefreshCw size={16} color="#16171b" />
                <Text style={styles.retryText}>Try again</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.empty}>
              <Inbox size={56} color="#33353b" />
              <Text style={styles.emptyTitle}>Nothing here yet</Text>
              <Text style={styles.emptyText}>
                Contributions and payouts from all your susu groups will show up here.
              </Text>
            </View>
          )
        }
      />
    </View>
  );
}

function contributionLabel(status) {
  return (
    { verified: "Verified", pending: "Verifying", failed: "Failed", flagged: "Flagged" }[status] || status
  );
}

function payoutLabel(status) {
  return (
    {
      completed: "Paid out",
      processing: "Sending",
      failed: "Transfer failed",
      skipped: "Round skipped",
    }[status] || status
  );
}

function statusColor(status) {
  if (status === "verified" || status === "completed") return { color: "#4ade80" };
  if (status === "pending" || status === "processing") return { color: "#fbb81c" };
  return { color: "#ef4444" };
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#16171b" },
  header: { paddingHorizontal: 20, paddingBottom: 12 },
  heading: { color: "#ffffff", fontSize: 30, fontWeight: "800", letterSpacing: -0.5 },
  sub: { color: "#8e8e93", fontSize: 13, marginTop: 2 },
  filters: { flexDirection: "row", gap: 8, paddingHorizontal: 20, paddingBottom: 12 },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#2a2b30",
    backgroundColor: "#1e1f24",
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipActive: { backgroundColor: "#fbb81c", borderColor: "#fbb81c" },
  chipText: { color: "#8e8e93", fontSize: 12, fontWeight: "700" },
  chipTextActive: { color: "#16171b" },
  list: { paddingHorizontal: 20, paddingBottom: 120 },
  sectionHeader: {
    color: "#8e8e93",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    marginTop: 16,
    marginBottom: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1e1f24",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#2a2b30",
  },
  iconWrap: { width: 30, alignItems: "center" },
  info: { flex: 1, marginLeft: 8 },
  title: { color: "#ffffff", fontSize: 14, fontWeight: "600" },
  meta: { color: "#8e8e93", fontSize: 12, marginTop: 2 },
  badgeRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  status: { fontSize: 11, fontWeight: "700" },
  youTag: {
    color: "#16171b",
    backgroundColor: "#fbb81c",
    fontSize: 9,
    fontWeight: "800",
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    overflow: "hidden",
  },
  amount: { color: "#ffffff", fontSize: 14, fontWeight: "700", marginLeft: 8 },
  amountPayout: { color: "#4ade80" },
  amountNeutral: { color: "#c9c9ce" },
  separator: { height: 8 },
  empty: { alignItems: "center", paddingTop: 80, paddingHorizontal: 40 },
  emptyTitle: { color: "#ffffff", fontSize: 17, fontWeight: "700", marginTop: 16 },
  emptyText: { color: "#8e8e93", fontSize: 13, textAlign: "center", marginTop: 8, lineHeight: 19 },
  retryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#fbb81c",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 20,
  },
  retryText: { color: "#16171b", fontSize: 14, fontWeight: "700" },
  skeletonWrap: { paddingTop: 8 },
  skeletonRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1e1f24",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#2a2b30",
    marginBottom: 8,
  },
  skeletonInfo: { flex: 1, marginLeft: 8 },
  skeletonGap: { marginTop: 8 },
});