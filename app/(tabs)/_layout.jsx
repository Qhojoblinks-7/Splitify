import React from "react";
import { Tabs } from "expo-router/js-tabs";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Home, User, UserGroup, ScanLine, Users } from "lucide-react-native";
import { useTabBarStore } from "../../store/tabBar";

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

  return (
    <TabBarContext.Provider value={{ mode, setMode, customButtons, setCustomButtons }}>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: "#fbb81c",
          tabBarInactiveTintColor: "#797777",
          tabBarStyle: {
            backgroundColor: "#16171b",
            borderTopWidth: 0,
            elevation: 0,
            height: 60,
            display: mode === "qr" || mode === "custom" ? "none" : "tab",
            headerShown: false,
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

const styles = StyleSheet.create({
  customBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
    backgroundColor: "#16171b",
    borderTopWidth: 1,
    borderTopColor: "#2a2b30",
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    zIndex: 1000,
  },
  customBtn: {
    flex: 1,
    backgroundColor: "#fbb81c",
    marginHorizontal: 20,
    borderRadius: 16,
    paddingVertical: 12,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },
  customBtnCancel: {
    backgroundColor: "#2a2b30",
    borderWidth: 1,
    borderColor: "#3a3b40",
  },
  customBtnPrimary: {
    backgroundColor: "#fbb81c",
  },
  customBtnText: { color: "#16171b", fontSize: 14, fontWeight: "bold" },
  customBtnCancelText: { color: "#ffffff" },
  customBtnPrimaryText: { color: "#16171b" },
});