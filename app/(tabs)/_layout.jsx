import React from "react";
import { Tabs } from "expo-router";
import { Platform, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { HandCoins, History, User, Users } from "lucide-react-native";
import { useQuery } from "@tanstack/react-query";
import { queries } from "../../services/query";
import colors from "../../theme/colors";

const STANDARD_TAB_BAR_HEIGHT = Platform.select({
  ios: 49,
  android: 56,
  default: 56,
});

/**
 * Total height the tab bar occupies, exposed so overlays rendered inside a tab
 * screen can reserve the same space the bar covers.
 */
export function useTabBarHeight() {
  const insets = useSafeAreaInsets();
  return STANDARD_TAB_BAR_HEIGHT + insets.bottom;
}

export default function TabLayout() {
  const tabBarHeight = useTabBarHeight();

  // A payment stuck pending, flagged or disputed is the
  // single strongest retention signal in the product, so it
  // is surfaced on the tab itself. The count is the
  // server's: what counts as needing attention is a domain
  // question (a failed attempt is settled, a flagged one is
  // not), and the server is the one holding every attempt.
  const { data: summary } = useQuery(queries.memberSummary());
  const attentionCount = summary?.attentionCount ?? 0;

  const tabIcon =
    (Icon, badge) =>
    ({ color, size }) => (
      <View>
        <Icon color={color} size={size} />
        {badge > 0 ? (
          <View style={styles.badge}>
            <View style={styles.badgeDot} />
          </View>
        ) : null}
      </View>
    );

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.gold,
        tabBarInactiveTintColor: colors.inactive,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopWidth: 0,
          elevation: 0,
          height: tabBarHeight,
        },
        tabBarLabelStyle: { fontSize: 12, fontWeight: "bold" },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Susu",
          tabBarIcon: tabIcon(HandCoins),
        }}
      />
      <Tabs.Screen
        name="groups"
        options={{
          title: "Groups",
          tabBarIcon: tabIcon(Users),
        }}
      />
      <Tabs.Screen
        name="activity"
        options={{
          title: "Activity",
          tabBarIcon: tabIcon(History, attentionCount),
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: "Account",
          tabBarIcon: tabIcon(User),
        }}
      />
    </Tabs>
  );
}

const styles = {
  badge: {
    position: "absolute",
    top: -2,
    right: -8,
    minWidth: 8,
    height: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.danger,
  },
};