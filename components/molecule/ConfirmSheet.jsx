import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import BottomSheet from "./BottomSheet";

export default function ConfirmSheet({
  isVisible,
  onClose,
  title,
  subtitle,
  confirmLabel = "Confirm",
  onConfirm,
}) {
  return (
    <BottomSheet
      isVisible={isVisible}
      onClose={onClose}
      title={title}
    >
      <View style={styles.content}>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        <View style={styles.buttonsRow}>
          <TouchableOpacity style={[styles.btn, styles.btnCancel]} onPress={onClose}>
            <Text style={styles.btnCancelText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, styles.btnConfirm]} onPress={() => {
            onConfirm?.();
            onClose();
          }}>
            <Text style={styles.btnConfirmText}>{confirmLabel}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingBottom: 24, gap: 24 },
  subtitle: {
    color: "#8e8e93",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  buttonsRow: {
    flexDirection: "row",
    gap: 12,
  },
  btn: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  btnCancel: {
    backgroundColor: "#2a2b30",
    borderWidth: 1,
    borderColor: "#33353b",
  },
  btnCancelText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
  btnConfirm: {
    backgroundColor: "#ff6b6b",
  },
  btnConfirmText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
});
