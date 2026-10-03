import React from "react";
import { Tabs } from "expo-router";
import { Platform, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { HandCoins, History, User } from "lucide-react-native";
import { useSusuStore } from "../../store/susu";

const NEEDS_ATTENTION = new Set(["pending", "failed", "flagged"]);

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

  // A contribution stuck pending, failed or flagged is the single strongest
  // retention signal in the product, so it is surfaced on the tab itself.
  const attentionCount = useSusuStore((s) =>
    s.groups.reduce(
      (total, group) =>
        total +
        group.contributions.filter(
          (c) => c.memberId === s.userId && NEEDS_ATTENTION.has(c.status)
        ).length,
      0
    )
  );

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
        tabBarActiveTintColor: "#fbb81c",
        tabBarInactiveTintColor: "#797777",
        tabBarStyle: {
          backgroundColor: "#16171b",
          borderTopWidth: 0,
          elevation: 0,
          height: tabBarHeight,
        },
        tabBarLabelStyle: { fontSize: 12, fontWeight: "bold" },
        sceneStyle: { backgroundColor: "#16171b" },
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
    backgroundColor: "#ef4444",
  },
};