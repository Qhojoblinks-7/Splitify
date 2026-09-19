import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { ChevronDown } from "lucide-react-native";
import BottomSheet from "./BottomSheet";

const categories = [
  "Roommates",
  "Travel",
  "Food & Dining",
  "Family",
  "Bills",
  "Shopping",
  "Other",
];

export default function EditGroupSheet({ isVisible, onClose, groupInfo, groupName, onSave }) {
  const [name, setName] = useState(groupName || "");
  const [description, setDescription] = useState(groupInfo?.description || "");
  const [category, setCategory] = useState(groupInfo?.category || "");
  const [showCategoryOptions, setShowCategoryOptions] = useState(false);

  const handleSave = () => {
    onSave?.({ name, description, category });
    onClose();
  };

  return (
    <BottomSheet
      isVisible={isVisible}
      onClose={onClose}
      title="Edit Group"
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Group Name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Enter group name"
            placeholderTextColor="#666666"
            style={styles.textInput}
            accessibilityLabel="Group name"
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Description</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Add a description"
            placeholderTextColor="#666666"
            style={[styles.textInput, styles.textArea]}
            multiline
            numberOfLines={3}
            accessibilityLabel="Group description"
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Category</Text>
          <TouchableOpacity
            style={styles.categorySelect}
            onPress={() => setShowCategoryOptions(true)}
            accessibilityLabel="Select category"
          >
            <Text style={[styles.categorySelectText, !category && styles.categorySelectPlaceholder]}>
              {category || "Select a category"}
            </Text>
            <ChevronDown size={18} color="#8e8e93" />
          </TouchableOpacity>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Created</Text>
          <Text style={styles.fieldValue}>{groupInfo?.created || "N/A"}</Text>
        </View>

        <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
          <Text style={styles.saveBtnText}>Save Changes</Text>
        </TouchableOpacity>
      </ScrollView>

      {showCategoryOptions && (
        <BottomSheet
          isVisible={showCategoryOptions}
          onClose={() => setShowCategoryOptions(false)}
          title="Select Category"
        >
          <View style={styles.categoryList}>
            {categories.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[
                  styles.categoryItem,
                  category === cat && styles.categoryItemSelected,
                ]}
                onPress={() => {
                  setCategory(cat);
                  setShowCategoryOptions(false);
                }}
                accessibilityRole="radio"
                accessibilityState={{ selected: category === cat }}
              >
                <Text style={[styles.categoryItemText, category === cat && styles.categoryItemTextSelected]}>
                  {cat}
                </Text>
                {category === cat && <View style={styles.categoryCheck} />}
              </TouchableOpacity>
            ))}
          </View>
        </BottomSheet>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    gap: 20,
  },
  fieldGroup: {
    gap: 8,
  },
  fieldLabel: {
    color: "#8e8e93",
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  fieldValue: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "500",
    paddingVertical: 14,
  },
  textInput: {
    color: "#ffffff",
    fontSize: 16,
    backgroundColor: "#2a2b30",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: "#33353b",
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  categorySelect: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#2a2b30",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: "#33353b",
  },
  categorySelectText: {
    color: "#ffffff",
    fontSize: 16,
  },
  categorySelectPlaceholder: {
    color: "#666666",
  },
  categoryList: {
    gap: 8,
  },
  categoryItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#2a2b30",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#33353b",
  },
  categoryItemSelected: {
    borderColor: "#fbb81c",
    backgroundColor: "#302f27",
  },
  categoryItemText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "500",
  },
  categoryItemTextSelected: {
    color: "#fbb81c",
    fontWeight: "700",
  },
  categoryCheck: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#fbb81c",
  },
  saveBtn: {
    backgroundColor: "#fbb81c",
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
  },
  saveBtnText: {
    color: "#16171b",
    fontSize: 16,
    fontWeight: "bold",
  },
});
