/**
 * Groups screen — all susus the signed-in member belongs to.
 * Fetches the same summary payload as home and renders the group list.
 */

import React, { useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  TextInput,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import { Plus, Users, LogIn } from "lucide-react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import BottomSheet from "../../components/molecule/BottomSheet";
import EmptyState from "../../components/molecule/EmptyState";
import { useTabBarHeight } from "./_layout";
import { SkeletonList } from "../../components/molecule/Skeleton";
import { ApiError } from "../../services/api";
import { formatGHC } from "../../services/money";
import { mutations, queries } from "../../services/query";
import { INVITE_CODE_LENGTH } from "../../services/susu";
import colors from "../../theme/colors";

function GroupCard({ group, onPress }) {
  const latest = group.rounds?.[0];
  const verified = latest?.verifiedTotalPesewas ?? 0;
  const target = group.targetPesewas;
  const progress = target > 0 ? Math.min(1, verified / target) : 0;
  const status =
    latest?.outcome === "paid"
      ? { label: "Paid out", color: colors.success }
      : latest?.outcome === "short"
        ? { label: "Below target", color: colors.amber }
        : { label: "Collecting", color: colors.gold };

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.topRow}>
        <View style={styles.iconWrap}>
          <Users size={20} color={colors.background} />
        </View>
        <View style={styles.titleWrap}>
          <Text style={styles.name} numberOfLines={1}>{group.name}</Text>
          <Text style={styles.meta}>
            Round {group.currentRound} · cycle {group.cycle}
          </Text>
        </View>
        <View style={[styles.badge, { borderColor: status.color }]}>
          <Text style={[styles.badgeText, { color: status.color }]}>{status.label}</Text>
        </View>
      </View>

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${Math.max(4, progress * 100)}%` }]} />
      </View>

      <View style={styles.bottomRow}>
        <View>
          <Text style={styles.pot}>{formatGHC(target)}</Text>
          <Text style={styles.potLabel}>pot per round</Text>
        </View>
        <View style={styles.turnWrap}>
          <Text style={styles.turnLabel}>verified in</Text>
          <Text style={styles.turnName} numberOfLines={1}>{formatGHC(verified)}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function GroupsScreen() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useTabBarHeight();
  const router = useRouter();
  const queryClient = useQueryClient();

  const {
    data: summary,
    error,
    isPending,
    refetch,
    isRefetching,
  } = useQuery(queries.memberSummary());

  const join = useMutation(mutations.joinGroup(queryClient));

  const [joinVisible, setJoinVisible] = React.useState(false);
  const [joinCode, setJoinCode] = React.useState("");
  const [joinError, setJoinError] = React.useState(null);

  const { join: joinCodeFromUrl } = useLocalSearchParams();
  const groups = summary?.groups ?? [];

  useEffect(() => {
    if (joinCodeFromUrl) {
      const cleaned = String(joinCodeFromUrl)
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "")
        .slice(0, INVITE_CODE_LENGTH);
      openJoin(cleaned.length === INVITE_CODE_LENGTH ? cleaned : "");
    }
  }, [joinCodeFromUrl]);

  useFocusEffect(
    React.useCallback(() => {
      return () => setJoinVisible(false);
    }, [])
  );

  const onRefresh = async () => {
    await refetch();
  };

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

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
        <View style={styles.headerRow}>
          <View style={styles.headerText}>
            <Text style={styles.title}>My Susu Groups</Text>
            <Text style={styles.subtitle}>
              {groups.length === 1 ? "1 active susu" : `${groups.length} active susus`}
            </Text>
          </View>
          <TouchableOpacity style={styles.headerBtn} onPress={() => openJoin()} activeOpacity={0.85}>
            <LogIn size={18} color={colors.background} />
            <Text style={styles.headerBtnText}>Join</Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={groups}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor={colors.gold} />}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          isPending ? (
            <View style={styles.stateBlock}>
              <SkeletonList count={3} />
            </View>
          ) : error ? (
            <View style={styles.stateBlock}>
              <EmptyState
                icon={AlertTriangle}
                iconColor={colors.danger}
                title="Could not load your groups"
                subtitle={
                  error instanceof ApiError && error.offline
                    ? "We could not reach Ntuboa. Nothing is lost — try again when you have signal."
                    : "Your groups could not be loaded."
                }
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
        renderItem={({ item }) => (
          <GroupCard
            group={item}
            onPress={() => router.push(`/susu/round?id=${item.id}`)}
          />
        )}
        ListFooterComponent={
          groups.length > 0 ? (
            <View style={styles.footer}>
              <TouchableOpacity style={styles.createBtn} onPress={() => router.push("/susu/create")}>
                <Plus size={20} color={colors.background} />
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
  header: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
  },
  headerText: { flex: 1 },
  headerBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.gold,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  headerBtnText: { color: colors.background, fontSize: 13, fontWeight: "700" },
  title: { color: colors.text, fontSize: 28, fontWeight: "800", letterSpacing: -0.5 },
  subtitle: { color: colors.textMuted, fontSize: 14, marginTop: 4 },
  list: { paddingHorizontal: 20, paddingBottom: 120 },
  stateBlock: { marginTop: 8 },
  footer: { marginTop: 8 },
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
  card: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  topRow: { flexDirection: "row", alignItems: "center" },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: colors.gold,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  titleWrap: { flex: 1 },
  name: { color: colors.text, fontSize: 17, fontWeight: "700" },
  meta: { color: colors.textMuted, fontSize: 13, marginTop: 3 },
  badge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: { fontSize: 11, fontWeight: "700" },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.borderSubtle,
    marginTop: 14,
    overflow: "hidden",
  },
  progressFill: { height: "100%", backgroundColor: colors.gold, borderRadius: 3 },
  bottomRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginTop: 14,
  },
  pot: { color: colors.text, fontSize: 18, fontWeight: "800" },
  potLabel: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  turnWrap: { alignItems: "flex-end" },
  turnLabel: { color: colors.textMuted, fontSize: 11 },
  turnName: { color: colors.text, fontSize: 14, fontWeight: "600", marginTop: 2 },
  sheet: { gap: 8, paddingHorizontal: 20 },
  codeBoxes: {
    flexDirection: "row",
    gap: 8,
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