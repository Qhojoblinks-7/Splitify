import React from "react";
import { Tabs } from "expo-router";
import { Platform, StyleSheet, TouchableOpacity, View, Text } from "react-native";
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

function CustomButtonBar({ mode, customButtons, insets }) {
  if (mode !== "custom" || customButtons.length === 0) return null;

  return (
    <View style={[styles.customButtonBar, { paddingBottom: insets.bottom }]}>
      {customButtons.map((btn, i) => (
        <TouchableOpacity
          key={i}
          style={[
            styles.customButton,
            btn.variant === "primary" && styles.customButtonPrimary,
            btn.variant === "cancel" && styles.customButtonCancel,
          ]}
          onPress={btn.onPress}
        >
          <Text style={[
            styles.customButtonText,
            btn.variant === "primary" && styles.customButtonTextPrimary,
            btn.variant === "cancel" && styles.customButtonTextCancel,
          ]}>
            {btn.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

export default function TabLayout() {
  const { mode, customButtons, setMode, setCustomButtons } = useTabBarStore();
  const insets = useSafeAreaInsets();
  const tabBarHeight = STANDARD_TAB_BAR_HEIGHT + insets.bottom;

  return (
    <TabBarContext.Provider value={{ mode, setMode, customButtons, setCustomButtons }}>
      <View style={styles.container}>
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
              display: mode === "qr" || mode === "custom" ? "none" : "flex",
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
              tabBarButton: (props) => (
                <TouchableOpacity
                  {...props}
                  style={[
                    styles.scanTabButton,
                    props.style,
                  ]}
                >
                  <View style={styles.scanTabIconWrapper}>
                    <ScanLine color="#16171b" size={30} />
                  </View>
                </TouchableOpacity>
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
        <CustomButtonBar mode={mode} customButtons={customButtons} insets={insets} />
      </View>
    </TabBarContext.Provider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scanTabButton: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: -24,
  },
  scanTabIconWrapper: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#fbb81c",
    justifyContent: "center",
    alignItems: "center",
  },
  customButtonBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-around",
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "#16171b",
    borderTopWidth: 1,
    borderTopColor: "#2a2b30",
  },
  customButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 120,
  },
  customButtonPrimary: {
    backgroundColor: "#fbb81c",
    marginRight: 8,
  },
  customButtonCancel: {
    backgroundColor: "#2a2b30",
    borderWidth: 1,
    borderColor: "#33353b",
    marginLeft: 8,
  },
  customButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  customButtonTextPrimary: {
    color: "#16171b",
  },
  customButtonTextCancel: {
    color: "#ffffff",
  },
});
