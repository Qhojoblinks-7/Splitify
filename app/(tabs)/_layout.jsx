import React from "react";
import { Tabs } from "expo-router/js-tabs";
import { Platform, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Home, User, UserGroup, ScanLine, Users } from "lucide-react-native";
import { useTabBarStore } from "../../store/tabBar";

const STANDARD_TAB_BAR_HEIGHT = Platform.select({
  ios: 49,
  android: 56,
  default: 56,
});

const TabBarContext = React.createContext({
  mode: "tabs",
  customButtons: [],
  setMode: () => {},
  setCustomButtons: () => {},
});

export function useTabBar() {
  return React.useContext(TabBarContext);
}

export default function TabLayout() {
  const { mode, customButtons, setMode, setCustomButtons } = useTabBarStore();
  const insets = useSafeAreaInsets();
  const tabBarHeight = STANDARD_TAB_BAR_HEIGHT + insets.bottom;

  return (
    <TabBarContext.Provider value={{ mode, setMode, customButtons, setCustomButtons }}>
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
            display: mode === "qr" || mode === "custom" ? "none" : "tab",
          },
          tabBarLabelStyle: {
            fontSize: 12,
            fontWeight: "bold",
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            headerShown: false,
            title: "Home",
            tabBarIcon: ({ color, size }) => (
              <Home color={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="groups"
          options={{
            title: "Groups",
            tabBarIcon: ({ color, size }) => (
              <UserGroup color={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="scan"
          options={{
            title: "Scan",
            tabBarIcon: ({ color, size }) => (
              <ScanLine color={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="contacts"
          options={{
            title: "Contacts",
            tabBarIcon: ({ color, size }) => (
              <Users color={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="account"
          options={{
            title: "Account",
            tabBarIcon: ({ color, size }) => (
              <User color={color} size={size} />
            ),
          }}
        />
      </Tabs>
    </TabBarContext.Provider>
  );
}
