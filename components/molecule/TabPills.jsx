import { View, Text, TouchableOpacity, StyleSheet } from "react-native";

export default function TabPills({ tabs, activeTab, onTabChange }) {
  return (
    <View style={styles.tabPills}>
      {tabs.map((tab) => (
        <TouchableOpacity
          key={tab}
          style={[
            styles.tabPill,
            activeTab === tab && styles.tabPillActive,
          ]}
          onPress={() => onTabChange(tab)}
        >
          <Text style={[
            styles.tabPillText,
            activeTab === tab && styles.tabPillTextActive,
          ]}>
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  tabPills: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 8,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#2a2b30",
  },
  tabPill: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: "#2a2b30",
    alignItems: "center",
  },
  tabPillActive: {
    backgroundColor: "#fbb81c",
  },
  tabPillText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
  },
  tabPillTextActive: {
    color: "#16171b",
  },
});
