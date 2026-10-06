/**
 * The member's real groups, from the server.
 *
 * This exists because there was no path from the app to its own data. The legacy group screen is
 * built on a local store whose group ids are strings the device invented, and the backend's are
 * integer primary keys — so a link from one to the other cannot be correct, only misleading. A
 * list built from `GET /api/groups/` carries the ids the API actually uses, which is what makes
 * the round screen reachable at all.
 *
 * Two things are deliberately not here. There is no create form, and there is no roster editor.
 * The backend will not accept a list of names for a rotation — a membership points at a real
 * account, so the only member this app can add is the person holding it. Offering a form that
 * looked like it worked and quietly did nothing would be worse than not offering it. P-S1, I51.
 *
 * Errors keep the split `ApiError` makes: a refusal is the server's answer and is shown as one,
 * while an unreachable server offers a retry, because those are the only two things that can
 * happen here and they mean opposite things to the member holding the phone.
 */

import React from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";

import { ApiError } from "../services/api";
import { queries } from "../services/query";
import colors from "../theme/colors";

function GroupCard({ group, onPress }) {
  const target = (group.targetPesewas / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const latest = group.rounds?.[0];

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <Text style={styles.cardName} numberOfLines={1}>
        {group.name}
      </Text>
      <Text style={styles.cardTarget}>GH¢ {target} per round</Text>
      <View style={styles.cardFooter}>
        <Text style={styles.cardMeta}>
          Round {group.currentRound} · cycle {group.cycle}
        </Text>
        {latest?.verifiedTotalPesewas != null && (
          <Text style={styles.cardMeta}>
            GH¢ {(latest.verifiedTotalPesewas / 100).toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}{" "}
            in
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

function GroupsScreen() {
  const router = useRouter();
  const { data, error, isPending, refetch, isRefetching } = useQuery(queries.groups());

  if (isPending) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.gold} />
      </View>
    );
  }

  if (error instanceof ApiError && error.refused) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorTitle}>Not available</Text>
        <Text style={styles.errorBody}>{error.message}</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorTitle}>Could not reach Growl</Text>
        <Text style={styles.errorBody}>
          Your groups could not be loaded. Nothing has been lost — try again when you have signal.
        </Text>
        <Text style={styles.retry} onPress={() => refetch()}>
          Try again
        </Text>
      </View>
    );
  }

  if (!data.length) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorTitle}>No groups yet</Text>
        <Text style={styles.errorBody}>
          Groups you create or join will appear here.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.gold} />
      }
    >
      {data.map((group) => (
        <GroupCard
          key={group.id}
          group={group}
          onPress={() => router.push(`/susu/round?id=${group.id}`)}
        />
      ))}
    </ScrollView>
  );
}

export default GroupsScreen;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, gap: 14, paddingBottom: 48 },

  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    backgroundColor: colors.background,
  },

  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: 18,
    gap: 6,
  },
  cardName: { color: colors.text, fontSize: 18, fontWeight: "700" },
  cardTarget: { color: colors.gold, fontSize: 15, fontWeight: "600" },
  cardFooter: { flexDirection: "row", justifyContent: "space-between", marginTop: 4 },
  cardMeta: { color: colors.textMuted, fontSize: 13 },

  errorTitle: { color: colors.text, fontSize: 20, fontWeight: "700", textAlign: "center" },
  errorBody: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: "center",
    marginTop: 8,
    lineHeight: 20,
  },
  retry: { color: colors.gold, fontSize: 15, fontWeight: "700", marginTop: 20 },
});