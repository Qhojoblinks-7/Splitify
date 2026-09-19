import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { ChevronLeft, MoreVertical } from "lucide-react-native";
import { useRouter } from "expo-router";

export default function GroupHeader({ groupName, onKebabPress, onKebabLayout }) {
  const router = useRouter();

  return (
    <View style={styles.header}>
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <ChevronLeft size={24} color="#fbb81c" />
      </TouchableOpacity>
      <Text style={styles.groupName}>{groupName}</Text>
      <TouchableOpacity
        style={styles.kebabBtn}
        onPress={onKebabPress}
        onLayout={onKebabLayout}
      >
        <MoreVertical size={24} color="#fbb81c" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#2a2b30",
  },
  backBtn: { padding: 8 },
  kebabBtn: { padding: 8 },
  groupName: { color: "#fbb81c", fontSize: 24, fontWeight: "bold", textAlign: "center", flex: 1 },
});
