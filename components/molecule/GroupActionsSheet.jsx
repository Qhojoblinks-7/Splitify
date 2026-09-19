import { TouchableOpacity, Text, View, StyleSheet } from "react-native";
import BottomSheet from "./BottomSheet";

export default function GroupActionsSheet({ isVisible, onClose }) {
  return (
    <BottomSheet
      isVisible={isVisible}
      onClose={onClose}
      title="Group Actions"
    >
      <View style={styles.content}>
        <TouchableOpacity style={styles.item} onPress={() => { onClose(); }}>
          <Text style={styles.itemText}>Edit Group</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.item} onPress={() => { onClose(); }}>
          <Text style={styles.itemText}>Manage Members</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.item} onPress={() => { onClose(); }}>
          <Text style={styles.itemText}>View Analytics</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.item, styles.itemDanger]} onPress={() => { onClose(); }}>
          <Text style={styles.itemTextDanger}>Delete Group</Text>
        </TouchableOpacity>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  content: { paddingVertical: 20 },
  item: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#2a2b30",
  },
  itemDanger: { borderBottomWidth: 0 },
  itemText: { color: "#ffffff", fontSize: 16, fontWeight: "500" },
  itemTextDanger: { color: "#ff6b6b", fontSize: 16, fontWeight: "500" },
});
