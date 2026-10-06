import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { CloudOff, RefreshCw, Clock } from "lucide-react-native";
import { useNetworkStore } from "../../store/network";
import { useQueueStore } from "../../store/queue";
import colors from "../../theme/colors";

export function OfflineBanner() {
  const isOnline = useNetworkStore((s) => s.isOnline);
  const queued = useQueueStore((s) => s.items.length);

  if (isOnline) return null;

  return (
    <View style={styles.banner}>
      <CloudOff size={16} color={colors.onGold} />
      <Text style={styles.text}>
        You are offline{queued > 0 ? ` · ${queued} saved on this phone` : ""}
      </Text>
      <Clock size={14} color={colors.onGold} />
    </View>
  );
}

export function PendingSyncBanner() {
  const queued = useQueueStore((s) => s.items.length);
  const isOnline = useNetworkStore((s) => s.isOnline);
  const check = useNetworkStore((s) => s.check);
  const drain = useQueueStore((s) => s.drain);

  if (!queued) return null;
  if (!isOnline) return null;

  return (
    <View style={[styles.banner, styles.bannerSync]}>
      <RefreshCw size={16} color={colors.onGold} />
      <Text style={styles.text}>
        {queued} contribution{queued === 1 ? "" : "s"} waiting to sync
      </Text>
      <Text
        style={styles.action}
        onPress={() => {
          drain();
          check();
        }}
      >
        Retry
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.danger,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bannerSync: { backgroundColor: colors.warningSoft },
  text: { color: colors.onGold, fontSize: 13, fontWeight: "600", flex: 1 },
  action: { color: colors.gold, fontSize: 13, fontWeight: "800" },
});

export default OfflineBanner;