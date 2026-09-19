import { View, Text, StyleSheet } from "react-native";
import BottomSheet from "./BottomSheet";

export default function CreateExpenseSheet({ isVisible, onClose }) {
  return (
    <BottomSheet
      isVisible={isVisible}
      onClose={onClose}
      title="Add Expense"
    >
      <View style={styles.content}>
        <Text style={styles.text}>Expense creation form will go here</Text>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  content: { paddingVertical: 20, alignItems: "center" },
  text: { color: "#8e8e93", fontSize: 16 },
});
