import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
  TextInput,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Plus, Users, TrendingUp, KeyRound, AlertTriangle, Clock, Hash, HandCoins, FileText, RefreshCw } from "lucide-react-native";
import SusuGroupCard from "../../components/molecule/SusuGroupCard";
import EmptyState from "../../components/molecule/EmptyState";
import BottomSheet from "../../components/molecule/BottomSheet";
import { useTabBarHeight } from "./_layout";
import OfflineBanner, { PendingSyncBanner } from "../../components/molecule/OfflineBanner";
import { SkeletonList } from "../../components/molecule/Skeleton";
import { useSusuStore } from "../../store/susu";
import { useSessionStore } from "../../store/session";
import { useNetworkStore } from "../../store/network";
import { activeMembers, dueSummary, INVITE_CODE_LENGTH } from "../../services/susu";
import colors from "../../theme/colors";

export default function SusuHome() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useTabBarHeight();
  const router = useRouter();
  const userId = useSusuStore((s) => s.userId);
  const allGroups = useSusuStore((s) => s.groups);
  const joinGroup = useSusuStore((s) => s.joinGroup);
  const isLoading = useSusuStore((s) => s.isLoading);
  const loadError = useSusuStore((s) => s.loadError);
  const loadGroups = useSusuStore((s) => s.loadGroups);
  const setOnline = useNetworkStore((s) => s.setOnline);
  const [refreshing, setRefreshing] = useState(false);

  const [joinVisible, setJoinVisible] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [joinName, setJoinName] = useState("");
  const [joinPhone, setJoinPhone] = useState("");
  const [joinError, setJoinError] = useState(null);

  const groups = useMemo(
    () =>
      allGroups
        .filter((group) => group.members.some((m) => m.id === userId))
        .sort((a, b) => Number(b.isActive) - Number(a.isActive) || b.createdAt - a.createdAt),
    [allGroups, userId]
  );

  const due = useMemo(() => dueSummary(groups, userId), [groups, userId]);

  const saved = useMemo(() => {
    let total = 0;
    for (const group of groups) {
      if (!group.isActive) continue;
      for (const payout of group.payouts || []) {
        if (payout.status === "completed" && payout.memberId === userId) total += payout.amount;
      }
    }
    return total;
  }, [groups, userId]);

  const totals = useMemo(() => {
    const active = groups.filter((g) => g.isActive);
    return {
      count: active.length,
      pot: active.reduce((sum, g) => sum + g.targetAmount, 0),
      members: new Set(active.flatMap((g) => activeMembers(g).map((m) => m.id))).size,
    };
  }, [groups]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadGroups();
    setRefreshing(false);
  };

  useEffect(() => {
    loadGroups();
    setOnline(true);
  }, [loadGroups, setOnline]);

  const openJoin = (presetCode = "") => {
    setJoinCode(
      String(presetCode)
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "")
        .slice(0, INVITE_CODE_LENGTH)
    );
    setJoinName("");
    setJoinPhone("");
    setJoinError(null);
    setJoinVisible(true);
  };

  /**
   * Invite links land as growl://join/<code>. Prefilling the sheet means a
   * member tapping a link in WhatsApp only has to confirm their name and
   * number, instead of reading a code aloud to the admin.
   */
  useEffect(() => {
    if (!router) return;
    const params = router.params || {};
    const code = params.join || params.code;
    if (code) openJoin(code);
  }, [router]);

  const actions = [
    { label: "Start", Icon: Plus, onPress: () => router.push("/susu/create") },
    { label: "Join", Icon: KeyRound, onPress: openJoin },
    {
      label: "Contribute",
      Icon: HandCoins,
      onPress: () => router.push(due[0] ? `/susu/${due[0].group.id}` : "/susu/create"),
    },
    { label: "Activity", Icon: FileText, onPress: () => router.push("/(tabs)/activity") },
  ];

  const onJoin = () => {
    const result = joinGroup(joinCode, { name: joinName, phone: joinPhone });
    if (!result.ok) {
      setJoinError(result.message);
      return;
    }
    setJoinVisible(false);
    router.push(`/susu/${result.groupId}`);
  };

  return (
    <View style={styles.container}>
      <View style={[styles.hero, { paddingTop: insets.top + 14 }]}>
        <Text style={styles.brand}>Growl</Text>
        <Text style={styles.tagline}>Grow Your Wealth Together</Text>

        <View style={styles.heroPotRow}>
          <Text style={styles.heroPot}>{saved.toLocaleString()}</Text>
          <Text style={styles.heroCurrency}>GHC</Text>
        </View>
        <Text style={styles.heroLabel}>Saved across your susus</Text>

        <View style={styles.actions}>
          {actions.map(({ label, Icon, onPress }) => (
            <TouchableOpacity
              key={label}
              style={({ pressed }) => [
                styles.actionColumn,
                pressed && { opacity: 0.7, transform: [{ scale: 0.96 }] },
              ]}
              onPress={onPress}
            >
              <View style={styles.coin}>
                <Icon width={20} height={20} color="#fbb81c" />
              </View>
              <Text style={styles.actionLabel}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <OfflineBanner />
      <PendingSyncBanner />

      <FlatList
        data={groups}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fbb81c" />}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View>
            {due.length > 0 && (
              <View style={styles.dueCard}>
                <View style={styles.dueHeader}>
                  {due.some((d) => d.overdue) ? (
                    <AlertTriangle size={18} color="#16171b" />
                  ) : (
                    <Clock size={18} color="#16171b" />
                  )}
                  <Text style={styles.dueTitle}>
                    {due.length === 1 ? "1 contribution due" : `${due.length} contributions due`}
                  </Text>
                </View>

                {due.slice(0, 4).map((item) => (
                  <TouchableOpacity
                    key={item.group.id}
                    style={styles.dueRow}
                    onPress={() => router.push(`/susu/${item.group.id}`)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.dueGroup} numberOfLines={1}>{item.group.name}</Text>
                    <Text style={styles.dueWhen}>
                      {item.overdue
                        ? `${Math.abs(item.days)}d overdue`
                        : item.days === 0
                          ? "due today"
                          : `in ${item.days}d`}
                    </Text>
                  </TouchableOpacity>
                ))}

                {due.length > 4 ? (
                  <Text style={styles.dueMore}>+{due.length - 4} more</Text>
                ) : null}
              </View>
            )}

            <View style={styles.summaryCard}>
              <View style={styles.summaryItem}>
                <Users size={18} color="#fbb81c" />
                <Text style={styles.summaryValue}>{totals.count}</Text>
                <Text style={styles.summaryLabel}>active susus</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <TrendingUp size={18} color="#4ade80" />
                <Text style={styles.summaryValue}>GHC {totals.pot.toLocaleString()}</Text>
                <Text style={styles.summaryLabel}>rotating weekly</Text>
              </View>
            </View>

            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>My Susu Groups</Text>
              <TouchableOpacity style={styles.joinLink} onPress={openJoin}>
                <KeyRound size={14} color="#fbb81c" />
                <Text style={styles.joinLinkText}>Join with code</Text>
              </TouchableOpacity>
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <SusuGroupCard
            group={item}
            userId={userId}
            onPress={() => router.push(`/susu/${item.id}`)}
          />
        )}
        ListEmptyComponent={
          isLoading ? (
            <View style={styles.stateBlock}>
              <SkeletonList count={3} />
            </View>
          ) : loadError ? (
            <View style={styles.stateBlock}>
              <EmptyState
                icon={AlertTriangle}
                iconColor={colors.danger}
                title="Could not load your groups"
                subtitle={loadError}
                actionLabel="Try again"
                actionIcon={RefreshCw}
                onAction={onRefresh}
              />
            </View>
          ) : (
            <EmptyState
              icon={Users}
              title="No susu groups yet"
              subtitle="Start a group with the people you trust, or join one you were invited to."
            />
          )
        }
        ListFooterComponent={
          groups.length > 0 ? (
            <View style={styles.footer}>
              <TouchableOpacity style={styles.createBtn} onPress={() => router.push("/susu/create")}>
                <Plus size={20} color="#16171b" />
                <Text style={styles.createBtnText}>Start a new susu</Text>
              </TouchableOpacity>
            </View>
          ) : null
        }
      />

      <BottomSheet
        isVisible={joinVisible}
        onClose={() => setJoinVisible(false)}
        title="Join a susu group"
        bottomInset={tabBarHeight}
      >
        <ScrollView contentContainerStyle={styles.sheetScroll} keyboardShouldPersistTaps="handled">
          <View style={styles.sheet}>
            <View style={styles.codeWrap}>
              <Hash size={20} color="#8e8e93" />
              <TextInput
                style={styles.codeInput}
                placeholder={"- - - - - -"}
                placeholderTextColor="#666666"
                value={joinCode}
                onChangeText={(text) => {
                  setJoinCode(text.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, INVITE_CODE_LENGTH));
                  setJoinError(null);
                }}
                autoCapitalize="characters"
                maxLength={INVITE_CODE_LENGTH}
                accessibilityLabel="Invite code"
              />
            </View>
            <Text style={styles.sheetHint}>
              Ask the group admin for the {INVITE_CODE_LENGTH}-character code. You will be added to the
              end of the rotation.
            </Text>

            <Text style={styles.sheetLabel}>Your name</Text>
            <TextInput
              style={styles.sheetInput}
              placeholder="Full name"
              placeholderTextColor="#666666"
              value={joinName}
              onChangeText={setJoinName}
              maxLength={40}
            />

            <Text style={styles.sheetLabel}>Mobile number</Text>
            <TextInput
              style={styles.sheetInput}
              placeholder="+233 ..."
              placeholderTextColor="#666666"
              value={joinPhone}
              onChangeText={setJoinPhone}
              keyboardType="phone-pad"
            />

            {joinError ? <Text style={styles.sheetError}>{joinError}</Text> : null}

            <TouchableOpacity
              style={[styles.submit, joinCode.length !== INVITE_CODE_LENGTH && styles.submitDisabled]}
              disabled={joinCode.length !== INVITE_CODE_LENGTH}
              onPress={onJoin}
            >
              <Text style={styles.submitText}>Join group</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#16171b" },
  hero: {
    paddingHorizontal: 20,
    paddingBottom: 26,
    backgroundColor: "#fbb81c",
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    marginBottom: 18,
  },
  brand: { color: "#16171b", fontSize: 26, fontWeight: "800", letterSpacing: -0.5 },
  tagline: { color: "#16171b", fontSize: 13, fontWeight: "600", opacity: 0.75, marginTop: 2 },
  heroPotRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginTop: 20,
  },
  heroPot: { color: "#16171b", fontSize: 44, fontWeight: "800", letterSpacing: -1 },
  heroCurrency: { color: "#16171b", fontSize: 16, fontWeight: "700", marginLeft: 6, marginBottom: 6 },
  heroLabel: { color: "#16171b", fontSize: 13, fontWeight: "600", opacity: 0.7, marginTop: 2 },
  actions: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 24,
  },
  actionColumn: { alignItems: "center", justifyContent: "center", flex: 1 },
  coin: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#16171b",
    borderWidth: 2,
    borderColor: "rgba(251, 184, 28, 0.45)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 6,
  },
  actionLabel: { color: "#16171b", fontSize: 12, fontWeight: "700", marginTop: 8 },
  list: { paddingHorizontal: 20, paddingBottom: 120 },
  stateBlock: { marginTop: 8 },
  summaryCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1e1f24",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#2a2b30",
    paddingVertical: 18,
    marginTop: 20,
  },
  summaryItem: { flex: 1, alignItems: "center", gap: 4 },
  summaryValue: { color: "#ffffff", fontSize: 18, fontWeight: "800" },
  summaryLabel: { color: "#8e8e93", fontSize: 11 },
  summaryDivider: { width: 1, height: 40, backgroundColor: "#2a2b30" },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 26,
    marginBottom: 12,
  },
  sectionTitle: { color: "#ffffff", fontSize: 18, fontWeight: "700" },
  joinLink: { flexDirection: "row", alignItems: "center", gap: 5 },
  joinLinkText: { color: "#fbb81c", fontSize: 13, fontWeight: "700" },
  dueCard: {
    backgroundColor: "#fbb81c",
    borderRadius: 18,
    padding: 16,
    marginTop: 20,
  },
  dueHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  dueTitle: { color: "#16171b", fontSize: 16, fontWeight: "800" },
  dueRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "rgba(22, 23, 27, 0.15)",
    paddingTop: 10,
    marginTop: 10,
  },
  dueGroup: { color: "#16171b", fontSize: 14, fontWeight: "600", flex: 1, marginRight: 10 },
  dueWhen: { color: "#16171b", fontSize: 12, fontWeight: "700" },
  dueMore: { color: "#16171b", fontSize: 12, fontWeight: "700", marginTop: 10 },
  sheetScroll: { paddingHorizontal: 20, paddingBottom: 60 },
  sheet: { gap: 8 },
  codeWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#222327",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#33353b",
    paddingHorizontal: 14,
    height: 56,
  },
  codeInput: {
    flex: 1,
    color: "#ffffff",
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: 6,
  },
  sheetLabel: { color: "#ffffff", fontSize: 14, fontWeight: "600", marginTop: 8 },
  sheetHint: { color: "#8e8e93", fontSize: 12, lineHeight: 18 },
  sheetInput: {
    backgroundColor: "#222327",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#33353b",
    paddingHorizontal: 14,
    paddingVertical: 14,
    color: "#ffffff",
    fontSize: 15,
  },
  sheetError: { color: "#ef4444", fontSize: 13, marginTop: 4 },
  submit: {
    backgroundColor: "#fbb81c",
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 16,
  },
  submitDisabled: { backgroundColor: "#2a2b30" },
  submitText: { color: "#16171b", fontSize: 16, fontWeight: "700" },
  footer: { marginTop: 8 },
  createBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#fbb81c",
    borderRadius: 16,
    paddingVertical: 16,
  },
  createBtnText: { color: "#16171b", fontSize: 16, fontWeight: "700" },
});