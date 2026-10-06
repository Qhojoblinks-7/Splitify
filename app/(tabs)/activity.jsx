/**
 * Activity, as the group's own record of itself.
 *
 * Every group keeps an append-only audit trail, readable by
 * every member (AT1, AT4), and that trail — not a local copy
 * of contributions — is what this tab shows. The feed says who
 * did what, in which round, and what state it moved: a payment
 * recorded, a payment verified, a dispute raised, a member
 * seated. Those are the events a member is accountable to
 * their circle for, and the server is the only writer of them.
 *
 * One feed per group, fetched in parallel and merged here. The
 * feeds are cached and invalidated whenever anything moves, so
 * merging them on the device is a sort, not a computation.
 */

import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
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
  Users,
} from "lucide-react-native";
import { useQueries, useQuery } from "@tanstack/react-query";
import OfflineBanner from "../../components/molecule/OfflineBanner";
import { SkeletonBlock } from "../../components/molecule/Skeleton";
import { ApiError } from "../../services/api";
import { queries } from "../../services/query";
import { getDayLabel } from "../../utils/dayLabel";
import colors from "../../theme/colors";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "money", label: "Money" },
  { id: "attention", label: "Needs attention" },
];

/** State a member (or an admin) has to look at. */
const ATTENTION_STATES = new Set(["flagged", "disputed"]);

/** Actions that move money, as opposed to moving people or rounds. */
const MONEY_ACTIONS = new Set([
  "contribution.recorded",
  "contribution.verified",
  "contribution.reversed",
  "contribution.voided",
  "payout.completed",
]);

export default function Activity() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [filter, setFilter] = useState("all");
  const [refreshing, setRefreshing] = useState(false);

  // The group list comes from the summary: one request, and the
  // same answer the home tab shows.
  const summary = useQuery(queries.memberSummary());
  const groups = summary.data?.groups ?? [];

  // One feed per group, in parallel. `useQueries` takes the exact
  // definitions the single-group screen uses, so a feed and its
  // screen cannot drift apart.
  const feeds = useQueries({
    queries: groups.map((group) => ({ ...queries.auditFeed(group.id) })),
  });

  const entries = useMemo(() => {
    const merged = feeds.flatMap((feed, index) =>
      (feed.data ?? []).map((event) => ({
        ...event,
        groupId: groups[index].id,
        groupName: groups[index].name,
      }))
    );
    return merged.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [feeds, groups]);

  const visible = useMemo(() => {
    if (filter === "money") return entries.filter((e) => MONEY_ACTIONS.has(e.action));
    if (filter === "attention") {
      return entries.filter(
        (e) => ATTENTION_STATES.has(e.toState) || String(e.action).startsWith("dispute")
      );
    }
    return entries;
  }, [entries, filter]);

  const attentionCount = useMemo(
    () =>
      entries.filter(
        (e) => ATTENTION_STATES.has(e.toState) || String(e.action).startsWith("dispute")
      ).length,
    [entries]
  );

  const sections = useMemo(() => {
    const buckets = new Map();
    for (const entry of visible) {
      const day = getDayLabel(new Date(entry.createdAt));
      if (!buckets.has(day)) buckets.set(day, []);
      buckets.get(day).push(entry);
    }
    return [...buckets.entries()].map(([title, data]) => ({ title, data }));
  }, [visible]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      summary.refetch(),
      ...feeds.map((feed) => feed.refetch()),
    ]);
    setRefreshing(false);
  };

  const anyLoading =
    summary.isPending || feeds.some((feed) => feed.isPending);
  const allFailed =
    !summary.isPending &&
    feeds.length > 0 &&
    feeds.every((feed) => feed.isError);

  const renderEntry = ({ item }) => (
    <TouchableOpacity
      style={styles.row}
      onPress={() => router.push(`/susu/round?id=${item.groupId}`)}
      activeOpacity={0.8}
    >
      <View style={styles.iconWrap}>{iconFor(item)}</View>

      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={1}>
          {describe(item)}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {item.groupName}
          {item.roundNumber != null ? ` · Round ${item.roundNumber}` : ""}
        </Text>
        <View style={styles.badgeRow}>
          <Text style={[styles.status, stateColor(item)]}>{stateLabel(item)}</Text>
          {item.actorName ? <Text style={styles.actorTag}>{item.actorName}</Text> : null}
        </View>
      </View>

      <Text style={styles.when}>
        {new Date(item.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <OfflineBanner />

      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.heading}>Activity</Text>
        <Text style={styles.sub}>
          The record across your {groups.length} susu {groups.length === 1 ? "group" : "groups"}
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
            tintColor={colors.gold}
            colors={[colors.gold]}
          />
        }
        ListEmptyComponent={
          anyLoading ? (
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
          ) : allFailed || summary.isError ? (
            <View style={styles.empty}>
              <AlertTriangle size={56} color={colors.danger} />
              <Text style={styles.emptyTitle}>Could not load your activity</Text>
              <Text style={styles.emptyText}>
                {summary.error instanceof ApiError && summary.error.offline
                  ? "We could not reach Ntuboa. Nothing is lost — try again when you have signal."
                  : "The groups' records could not be loaded."}
              </Text>
              <TouchableOpacity style={styles.retryBtn} onPress={onRefresh}>
                <RefreshCw size={16} color={colors.background} />
                <Text style={styles.retryText}>Try again</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.empty}>
              <Inbox size={56} color={colors.border} />
              <Text style={styles.emptyTitle}>Nothing here yet</Text>
              <Text style={styles.emptyText}>
                What happens in your susu groups — payments recorded and verified,
                members seated, rounds closed — shows up here.
              </Text>
            </View>
          )
        }
      />
    </View>
  );
}

/**
 * One event, in the member's words. The actor is named by the
 * server (`display_name`, never a phone number — AT4); an event
 * with no human behind it is Ntuboa itself, such as a round
 * closing on its due date.
 */
function describe(event) {
  const who = event.actorName || "Ntuboa";
  switch (event.action) {
    case "contribution.recorded":
      return `${who} recorded a payment`;
    case "contribution.verified":
      return `${who} verified a payment`;
    case "contribution.reversed":
      return `${who} reversed a payment`;
    case "contribution.voided":
      return `${who} withdrew a payment attempt`;
    case "payout.completed":
      return "The pot was paid out";
    case "membership.joined":
      return `${who} joined the group`;
    case "membership.deactivated":
      return `${who} was removed from the rotation`;
    case "group.created":
      return `${who} started this group`;
    case "round.closed":
      return "The round closed";
    case "round.debt_booked":
      return "The round's shortfall was booked as debt";
    case "debt.charged":
      return "A missed share was charged";
    default:
      if (String(event.action).startsWith("dispute")) {
        return `${who} raised a dispute`;
      }
      return String(event.action).replace(/\./g, " ");
  }
}

function stateLabel(event) {
  if (event.toState) return event.toState;
  if (event.fromState) return event.fromState;
  return "recorded";
}

function stateColor(event) {
  if (ATTENTION_STATES.has(event.toState)) return { color: colors.danger };
  if (event.toState === "verified" || event.toState === "completed" || event.toState === "active") {
    return { color: colors.success };
  }
  if (event.toState === "pending" || event.toState === "processing" || event.toState === "queued") {
    return { color: colors.gold };
  }
  return { color: colors.textMuted };
}

function iconFor(event) {
  if (MONEY_ACTIONS.has(event.action)) {
    if (event.action === "payout.completed") {
      return <ArrowDownLeft size={15} color={colors.success} />;
    }
    if (event.toState === "verified") return <CheckCircle2 size={15} color={colors.success} />;
    if (ATTENTION_STATES.has(event.toState)) return <XCircle size={15} color={colors.danger} />;
    return <Clock size={15} color={colors.gold} />;
  }
  if (String(event.action).startsWith("dispute") || ATTENTION_STATES.has(event.toState)) {
    return <AlertTriangle size={15} color={colors.amber} />;
  }
  return <Users size={15} color={colors.textMuted} />;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: 20, paddingBottom: 12 },
  heading: { color: colors.text, fontSize: 30, fontWeight: "800", letterSpacing: -0.5 },
  sub: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  filters: { flexDirection: "row", justifyContent: "center", gap: 8, paddingHorizontal: 20, paddingBottom: 12 },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipActive: { backgroundColor: colors.gold, borderColor: colors.gold },
  chipText: { color: colors.textMuted, fontSize: 12, fontWeight: "700" },
  chipTextActive: { color: colors.background },
  list: { paddingHorizontal: 20, paddingBottom: 120 },
  sectionHeader: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    marginTop: 16,
    marginBottom: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  iconWrap: { width: 30, alignItems: "center" },
  info: { flex: 1, marginLeft: 8 },
  title: { color: colors.text, fontSize: 14, fontWeight: "600" },
  meta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  badgeRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  status: { fontSize: 11, fontWeight: "700" },
  actorTag: { color: colors.textMuted, fontSize: 10, fontWeight: "600" },
  when: { color: colors.textMuted, fontSize: 11, marginLeft: 8 },
  separator: { height: 8 },
  empty: { alignItems: "center", paddingTop: 80, paddingHorizontal: 40 },
  emptyTitle: { color: colors.text, fontSize: 17, fontWeight: "700", marginTop: 16 },
  emptyText: { color: colors.textMuted, fontSize: 13, textAlign: "center", marginTop: 8, lineHeight: 19 },
  retryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.gold,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 20,
  },
  retryText: { color: colors.background, fontSize: 14, fontWeight: "700" },
  skeletonWrap: { paddingTop: 8 },
  skeletonRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    marginBottom: 8,
  },
  skeletonInfo: { flex: 1, marginLeft: 8 },
  skeletonGap: { marginTop: 8 },
});
