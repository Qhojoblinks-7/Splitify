import { View, Text, StyleSheet } from "react-native";
import BottomSheet from "./BottomSheet";

export default function PaymentSheet({ isVisible, onClose, paymentCard }) {
  if (!paymentCard) return null;

  return (
    <BottomSheet
      isVisible={isVisible}
      onClose={onClose}
      title="Pay"
    >
      <View style={styles.content}>
        <View style={styles.divider} />

        <Text style={styles.paymentLabel}>Amount</Text>
        <Text style={styles.paymentAmount}>{paymentCard.amount}</Text>

        <View style={styles.payToRow}>
          <Text style={styles.payToLabel}>Pay to</Text>
          <View style={styles.payToLine} />
        </View>

        <View style={styles.receiverRow}>
          <View style={styles.receiverAvatar}>
            <Text style={styles.receiverAvatarText}>
              {(paymentCard.receipientName || "R").charAt(0)}
            </Text>
          </View>
          <View style={styles.receiverInfo}>
            <Text style={styles.receiverName}>{paymentCard.receipientName || "Receiver"}</Text>
            <Text style={styles.receiverEmail}>{paymentCard.receipientEmail || "receiver@example.com"}</Text>
          </View>
        </View>

        <View style={styles.divider} />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    paddingBottom: 84,
  },
  divider: {
    height: 1,
    backgroundColor: "#33353b",
    marginVertical: 16,
  },
  paymentLabel: {
    color: "#8e8e93",
    fontSize: 14,
    fontWeight: "600",
  },
  paymentAmount: {
    color: "#ffffff",
    fontSize: 30,
    fontWeight: "bold",
    marginVertical: 4,
  },
  payToRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 18,
  },
  payToLabel: {
    color: "#8e8e93",
    fontSize: 14,
    fontWeight: "600",
    marginRight: 10,
  },
  payToLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#33353b",
  },
  receiverRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 16,
  },
  receiverAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#fbb81c",
    justifyContent: "center",
    alignItems: "center",
  },
  receiverAvatarText: {
    color: "#16171b",
    fontSize: 16,
    fontWeight: "bold",
  },
  receiverInfo: {
    marginLeft: 14,
    flex: 1,
  },
  receiverName: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
  receiverEmail: {
    color: "#8e8e93",
    fontSize: 13,
    marginTop: 3,
  },
});
