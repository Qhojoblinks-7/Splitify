/**
 * The home tab — action-oriented dashboard.
 * Shows total received, contributions due, and quick actions.
 * Group listings moved to the Groups tab.
 */

import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  RefreshControl,
  FlatList,
  TextInput,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Plus, Users, TrendingUp, AlertTriangle, HandCoins, FileText, RefreshCw } from "lucide-react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import BottomSheet from "../../components/molecule/BottomSheet";
import EmptyState from "../../components/molecule/EmptyState";
import { useTabBarHeight } from "./_layout";
import OfflineBanner, { PendingSyncBanner } from "../../components/molecule/OfflineBanner";
import { SkeletonList } from "../../components/molecule/Skeleton";
import { ApiError } from "../../services/api";
import { formatGHC } from "../../services/money";
import { mutations, queries } from "../../services/query";
import { INVITE_CODE_LENGTH } from "../../services/susu";
import colors from "../../theme/colors";

export default function SusuHome() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const tabBarHeight = useTabBarHeight();

  const {
    data: summary,
    error,
    isPending,
    refetch,
    isRefetching,
  } = useQuery(queries.memberSummary());

  const join = useMutation(mutations.joinGroup(queryClient));

  const [joinVisible, setJoinVisible] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [joinError, setJoinError] = useState(null);

  const due = summary?.due ?? [];
  const activeCount = summary?.activeGroupCount ?? 0;

  const onRefresh = async () => {
    await refetch();
  };

  useEffect(() => {
    const params = router.params || {};
    const code = params.join || params.code;
    if (code) {
      router.push(`/(tabs)/groups?join=${code}`);
    }
  }, [router]);

  useFocusEffect(
    React.useCallback(() => {
      return () => setJoinVisible(false);
    }, [])
  );

  const openJoin = (presetCode = "") => {
    setJoinCode(
      String(presetCode)
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "")
        .slice(0, INVITE_CODE_LENGTH)
    );
    setJoinError(null);
    setJoinVisible(true);
  };

  const onJoin = () => {
    setJoinError(null);
    join.mutate(
      { inviteCode: joinCode },
      {
        onSuccess: (group) => {
          setJoinVisible(false);
          router.push(`/susu/round?id=${group.id}`);
        },
        onError: (err) => {
          setJoinError(err instanceof ApiError ? err.message : "That code could not be redeemed.");
        },
      }
    );
  };

  const dueLabel = (entry) => {
    const days = Math.ceil(
      (new Date(entry.dueAt) - Date.now()) / 86400000
    );
    return days < 0
      ? `${Math.abs(days)}d overdue`
      : days === 0
        ? "due today"
        : `in ${days}d`;
  };

  const actions = [
    { label: "Join", Icon: Users, onPress: () => openJoin() },
    { label: "Start", Icon: Plus, onPress: () => router.push("/susu/create") },
    {
      label: "Contribute",
      Icon: HandCoins,
      onPress: () => router.push(due[0] ? `/susu/round?id=${due[0].groupId}` : "/susu/create"),
    },
    { label: "Activity", Icon: FileText, onPress: () => router.push("/(tabs)/activity") },
  ];

  return (
    <View style={styles.container}>
      <View style={[styles.hero, { paddingTop: insets.top + 14 }]}>
        <Text style={styles.brand}>Ntuboa</Text>

        <View style={styles.heroPotRow}>
          <Text style={styles.heroPot}>{formatGHC(summary?.receivedPesewas ?? 0)}</Text>
          <Text style={styles.heroCurrency}>GHC</Text>
        </View>
        <Text style={styles.heroLabel}>Received from your susus</Text>

        <View style={styles.actions}>
          {actions.map(({ label, Icon, onPress }) => (
            <Pressable
              key={label}
              style={({ pressed }) => [
                styles.actionColumn,
                pressed && { opacity: 0.7 },
              ]}
              onPress={onPress}
              android_ripple={null}
            >
              <View style={styles.coin}>
                <Icon width={20} height={20} color={colors.gold} />
              </View>
              <Text style={styles.actionLabel}>{label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <OfflineBanner />
      <PendingSyncBanner />

      <FlatList
        data={due}
        keyExtractor={(item) => `${item.groupId}-${item.roundId}`}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor={colors.gold} />}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          isPending ? (
            <View style={styles.stateBlock}>
              <SkeletonList count={2} />
            </View>
          ) : due.length === 0 ? (
            <View style={styles.stateBlock}>
              <EmptyState
                icon={AlertTriangle}
                iconColor={colors.success}
                title="All caught up"
                subtitle="No contributions due right now. Enjoy the breather."
              />
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.dueRow}
            onPress={() => router.push(`/susu/round?id=${item.groupId}`)}
            activeOpacity={0.8}
          >
            <View style={styles.dueRowLeft}>
              <View style={styles.dueGroupWrap}>
                <Text style={styles.dueGroup} numberOfLines={1}>{item.groupName}</Text>
                <Text style={styles.dueWhen}>
                  {formatGHC(item.sharePesewas)} · {dueLabel(item)}
                </Text>
              </View>
            </View>
            <HandCoins size={20} color={colors.gold} />
          </TouchableOpacity>
        )}
        ListFooterComponent={null}
      />

      <View style={styles.summaryCardWrapper}>
        <View style={styles.summaryCard}>
          <View style={styles.summaryItem}>
            <Users size={18} color={colors.gold} />
            <Text style={styles.summaryValue}>{activeCount}</Text>
            <Text style={styles.summaryLabel}>active susus</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <TrendingUp size={18} color={colors.success} />
            <Text style={styles.summaryValue}>{formatGHC(summary?.potTotalPesewas ?? 0)}</Text>
            <Text style={styles.summaryLabel}>rotating weekly</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <HandCoins size={18} color={colors.gold} />
            <Text style={styles.summaryValue}>{formatGHC(summary?.contributedPesewas ?? 0)}</Text>
            <Text style={styles.summaryLabel}>paid in, verified</Text>
          </View>
        </View>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.createBtn} onPress={() => router.push("/susu/create")}>
          <Plus size={20} color={colors.background} />
          <Text style={styles.createBtnText}>Start a new susu</Text>
        </TouchableOpacity>
      </View>

      <BottomSheet
        isVisible={joinVisible}
        onClose={() => setJoinVisible(false)}
        title="Join a susu group"
        bottomInset={tabBarHeight}
      >
        <View style={styles.sheet}>
          <View style={styles.codeBoxes}>
            {Array.from({ length: INVITE_CODE_LENGTH }, (_, i) => (
                <TextInput
                  key={i}
                  style={styles.codeBox}
                  value={joinCode[i] || ""}
                  onChangeText={(text) => {
                    const filtered = text.toUpperCase().replace(/[^A-Z0-9]/g, "");
                    if (filtered.length <= 1) {
                      const nextCode = joinCode.split("");
                      nextCode[i] = filtered;
                      // Auto-advance to next box
                      if (filtered && i < INVITE_CODE_LENGTH - 1) {
                        // Focus handled by ref in real implementation
                      }
                      // Auto-delete goes to previous
                      if (!filtered && i > 0) {
                        // Focus handled by ref in real implementation
                      }
                      setJoinCode(nextCode.join(""));
                      setJoinError(null);
                    }
                  }}
                  maxLength={1}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  keyboardType="alphanumeric"
                  textAlign="center"
                  accessibilityLabel={`Invite code character ${i + 1}`}
                />
              ))}
            </View>

          {joinError ? <Text style={styles.sheetError}>{joinError}</Text> : null}

          <TouchableOpacity
            style={[styles.submit, (joinCode.length !== INVITE_CODE_LENGTH || join.isPending) && styles.submitDisabled]}
            disabled={joinCode.length !== INVITE_CODE_LENGTH || join.isPending}
            onPress={onJoin}
          >
            <Text style={styles.submitText}>
              {join.isPending ? "Joining…" : "Join group"}
            </Text>
          </TouchableOpacity>

          <Text style={styles.sheetHint}>
            Ask the group admin for the {INVITE_CODE_LENGTH}-character code. You will be
            added to the end of the rotation, under your own account.
          </Text>
        </View>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  hero: {
    paddingHorizontal: 20,
    paddingBottom: 26,
    backgroundColor: colors.gold,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    marginBottom: 18,
  },
  brand: { color: colors.background, fontSize: 26, fontWeight: "800", letterSpacing: -0.5 },
  heroPotRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginTop: 20,
    alignSelf: "center",
  },
  heroPot: { color: colors.background, fontSize: 56, fontWeight: "800", letterSpacing: -1.5 },
  heroCurrency: { color: colors.background, fontSize: 18, fontWeight: "700", marginLeft: 10, marginBottom: 10 },
  heroLabel: { color: colors.background, fontSize: 13, fontWeight: "600", opacity: 0.7, marginTop: 2, alignSelf: "center" },
  actions: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 24,
  },
  actionColumn: { alignItems: "center", justifyContent: "flex-start", flex: 1 },
  coin: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.tintGoldBorder,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 6,
  },
  actionLabel: { color: colors.background, fontSize: 12, fontWeight: "700", marginTop: 8 },
  list: { paddingHorizontal: 20, paddingBottom: 120 },
  stateBlock: { marginTop: 8 },
  summaryCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: 16,
  },
  summaryCardWrapper: { paddingHorizontal: 20 },
  summaryItem: { flex: 1, alignItems: "center", gap: 4 },
  summaryValue: { color: colors.text, fontSize: 15, fontWeight: "800" },
  summaryLabel: { color: colors.textMuted, fontSize: 10 },
  summaryDivider: { width: 1, height: 40, backgroundColor: colors.borderSubtle },
  dueRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  dueRowLeft: { flex: 1 },
  dueGroupWrap: { gap: 4 },
  dueGroup: { color: colors.text, fontSize: 16, fontWeight: "700" },
  dueWhen: { color: colors.textMuted, fontSize: 13, fontWeight: "600" },
  footer: { marginTop: 8, paddingHorizontal: 20 },
  createBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.gold,
    borderRadius: 16,
    paddingVertical: 16,
  },
  createBtnText: { color: colors.background, fontSize: 16, fontWeight: "700" },
  sheet: { gap: 8, paddingHorizontal: 20 },
  codeBoxes: {
    flexDirection: "row",
    gap: 8,
    flex: 1,
    justifyContent: "center",
  },
  codeBox: {
    width: 40,
    height: 48,
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center",
    textAlignVertical: "center",
    padding: 0,
  },
  hiddenInput: {
    position: "absolute",
    opacity: 0,
    width: 0,
    height: 0,
    pointerEvents: "none",
  },
  sheetHint: { color: colors.textMuted, fontSize: 12, lineHeight: 18 },
  sheetError: { color: colors.danger, fontSize: 13, marginTop: 4 },
  submit: {
    backgroundColor: colors.gold,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 16,
    width: "75%",
    alignSelf: "center",
  },
  submitDisabled: { backgroundColor: colors.borderSubtle },
  submitText: { color: colors.background, fontSize: 16, fontWeight: "700" },
});